import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const HeaderControlsContext = createContext(null);

export function HeaderControlsProvider({ metadata, children }) {
  const [target, setTarget] = useState(null);
  const [registration, setRegistration] = useState(null);

  const registerCommands = useCallback((slot, commandsRef) => {
    setRegistration({ slot, commandsRef });
    return () => setRegistration((current) => current?.slot === slot ? null : current);
  }, []);

  const getRouteCommands = useCallback(() => {
    if (!registration || !metadata.headerControls?.includes(registration.slot)) return [];
    const permitted = metadata.commandActions || [];
    return registration.commandsRef.current.filter((command) => permitted.includes(command.id));
  }, [metadata, registration]);

  const value = useMemo(() => ({
    metadata,
    target,
    setTarget,
    registerCommands,
    getRouteCommands,
  }), [getRouteCommands, metadata, registerCommands, target]);

  return <HeaderControlsContext.Provider value={value}>{children}</HeaderControlsContext.Provider>;
}

export function RouteHeaderControls({ slot, commands = [], children }) {
  const context = useContext(HeaderControlsContext);
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const supported = Boolean(context?.metadata.headerControls?.includes(slot));
  const registerCommands = context?.registerCommands;

  useEffect(() => {
    if (!supported) return undefined;
    return registerCommands(slot, commandsRef);
  }, [registerCommands, slot, supported]);

  if (!context?.target || !supported) return null;
  return createPortal(children, context.target);
}

export function useHeaderControlsRuntime() {
  const context = useContext(HeaderControlsContext);
  if (!context) throw new Error('Header must be rendered inside HeaderControlsProvider.');
  return context;
}
