const PUBLIC_TABLE_VIOLATIONS_SQL = `
  SELECT
    relation.relname AS object_name,
    NOT relation.relrowsecurity AS rls_disabled
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
    AND (
      NOT relation.relrowsecurity
      OR EXISTS (
        SELECT 1
        FROM pg_roles api_role
        WHERE api_role.rolname IN ('anon', 'authenticated')
          AND (
            has_table_privilege(api_role.rolname, relation.oid, 'SELECT')
            OR has_table_privilege(api_role.rolname, relation.oid, 'INSERT')
            OR has_table_privilege(api_role.rolname, relation.oid, 'UPDATE')
            OR has_table_privilege(api_role.rolname, relation.oid, 'DELETE')
          )
      )
      OR EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) privilege
        WHERE privilege.grantee = 0
          AND privilege.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      )
    )
  ORDER BY relation.relname
`;

const PUBLIC_FUNCTION_VIOLATIONS_SQL = `
  SELECT
    routine.proname AS object_name,
    pg_get_function_identity_arguments(routine.oid) AS arguments
  FROM pg_proc routine
  JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
  WHERE namespace.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend dependency
      WHERE dependency.classid = 'pg_proc'::regclass
        AND dependency.objid = routine.oid
        AND dependency.deptype = 'e'
    )
    AND (
      EXISTS (
        SELECT 1
        FROM pg_roles api_role
        WHERE api_role.rolname IN ('anon', 'authenticated')
          AND has_function_privilege(api_role.rolname, routine.oid, 'EXECUTE')
      )
      OR EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) privilege
        WHERE privilege.grantee = 0
          AND privilege.privilege_type = 'EXECUTE'
      )
    )
  ORDER BY routine.proname, arguments
`;

const PUBLIC_SEQUENCE_VIOLATIONS_SQL = `
  SELECT DISTINCT sequence_relation.relname AS object_name
  FROM pg_class sequence_relation
  JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence_relation.relnamespace
  JOIN pg_depend dependency
    ON dependency.classid = 'pg_class'::regclass
   AND dependency.objid = sequence_relation.oid
  JOIN pg_class table_relation ON table_relation.oid = dependency.refobjid
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_relation.relnamespace
  WHERE sequence_relation.relkind = 'S'
    AND sequence_namespace.nspname = 'public'
    AND table_namespace.nspname = 'public'
    AND (
      EXISTS (
        SELECT 1
        FROM pg_roles api_role
        WHERE api_role.rolname IN ('anon', 'authenticated')
          AND (
            has_sequence_privilege(api_role.rolname, sequence_relation.oid, 'USAGE')
            OR has_sequence_privilege(api_role.rolname, sequence_relation.oid, 'SELECT')
          )
      )
      OR EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(sequence_relation.relacl, acldefault('S', sequence_relation.relowner))) privilege
        WHERE privilege.grantee = 0
          AND privilege.privilege_type IN ('USAGE', 'SELECT')
      )
    )
  ORDER BY sequence_relation.relname
`;

const PUBLIC_DEFAULT_PRIVILEGE_VIOLATIONS_SQL = `
  WITH creator_roles AS (
    SELECT oid, rolname
    FROM pg_roles
    WHERE rolname IN (current_user, 'postgres', 'supabase_admin')
  ), object_types(object_type, protected_privileges) AS (
    VALUES
      ('r'::"char", ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]),
      ('S'::"char", ARRAY['USAGE', 'SELECT']::text[]),
      ('f'::"char", ARRAY['EXECUTE']::text[])
  )
  SELECT DISTINCT
    creator.rolname AS creator_role,
    object_type.object_type::text AS object_type,
    COALESCE(grantee.rolname, 'PUBLIC') AS grantee
  FROM creator_roles creator
  CROSS JOIN object_types object_type
  LEFT JOIN pg_namespace namespace ON namespace.nspname = 'public'
  LEFT JOIN pg_default_acl defaults
    ON defaults.defaclrole = creator.oid
   AND defaults.defaclnamespace = namespace.oid
   AND defaults.defaclobjtype = object_type.object_type
  CROSS JOIN LATERAL aclexplode(
    COALESCE(defaults.defaclacl, acldefault(object_type.object_type, creator.oid))
  ) privilege
  LEFT JOIN pg_roles grantee ON grantee.oid = privilege.grantee
  WHERE (privilege.grantee = 0 OR grantee.rolname IN ('anon', 'authenticated'))
    AND privilege.privilege_type = ANY (object_type.protected_privileges)
  ORDER BY creator_role, object_type, grantee
`;

export async function auditPublicSchemaSecurity(queryable) {
  const [tables, functions, sequences, defaults] = await Promise.all([
    queryable.query(PUBLIC_TABLE_VIOLATIONS_SQL),
    queryable.query(PUBLIC_FUNCTION_VIOLATIONS_SQL),
    queryable.query(PUBLIC_SEQUENCE_VIOLATIONS_SQL),
    queryable.query(PUBLIC_DEFAULT_PRIVILEGE_VIOLATIONS_SQL),
  ]);

  return {
    tables: tables.rows,
    functions: functions.rows,
    sequences: sequences.rows,
    defaultPrivileges: defaults.rows,
  };
}

export async function assertPublicSchemaSecurity(queryable) {
  const violations = await auditPublicSchemaSecurity(queryable);
  const populated = Object.entries(violations).filter(([, rows]) => rows.length > 0);

  if (populated.length > 0) {
    const summary = populated
      .map(([category, rows]) => `${category}: ${rows.map((row) => row.object_name ?? `${row.creator_role}/${row.object_type}/${row.grantee}`).join(', ')}`)
      .join('; ');
    throw new Error(`Public-schema security verification failed (${summary}).`);
  }

  return violations;
}

export const securityCatalogQueries = Object.freeze({
  tables: PUBLIC_TABLE_VIOLATIONS_SQL,
  functions: PUBLIC_FUNCTION_VIOLATIONS_SQL,
  sequences: PUBLIC_SEQUENCE_VIOLATIONS_SQL,
  defaultPrivileges: PUBLIC_DEFAULT_PRIVILEGE_VIOLATIONS_SQL,
});
