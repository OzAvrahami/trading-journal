import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Modal } from '../ui/Modal.jsx';

export function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) => `${command.label} ${command.description || ''} ${command.keywords || ''}`.toLowerCase().includes(normalized));
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filteredCommands.length) setActiveIndex(0);
  }, [activeIndex, filteredCommands.length]);

  function activate(command) {
    if (!command) return;
    onClose();
    command.action();
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => filteredCommands.length ? (current + 1) % filteredCommands.length : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => filteredCommands.length ? (current - 1 + filteredCommands.length) % filteredCommands.length : 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activate(filteredCommands[activeIndex]);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Search or run a command" size="md">
      <label className="flex min-h-11 items-center gap-2 rounded-md border border-default bg-surface-raised px-3">
        <MagnifyingGlass size={17} className="shrink-0 text-muted" aria-hidden="true" />
        <span className="sr-only">Search commands</span>
        <input
          type="search"
          value={query}
          data-autofocus
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Navigate or run an available action"
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-primary outline-none placeholder:text-muted"
        />
      </label>

      <div className="mt-3" role="listbox" aria-label="Available commands">
        {filteredCommands.length ? filteredCommands.map((command, index) => {
          const Icon = command.Icon;
          const selected = index === activeIndex;
          return (
            <button
              key={command.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-start transition-colors ${selected ? 'bg-action-soft text-primary' : 'text-secondary hover:bg-surface-raised hover:text-primary'}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => activate(command)}
            >
              {Icon && <Icon size={17} className="shrink-0 text-muted" aria-hidden="true" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{command.label}</span>
                {command.description && <span className="block truncate text-xs text-muted">{command.description}</span>}
              </span>
            </button>
          );
        }) : (
          <p className="px-3 py-6 text-center text-sm text-muted">No matching commands</p>
        )}
      </div>
      <p className="mt-3 border-t border-default pt-3 text-xs text-muted">
        <span className="font-mono" dir="ltr">Up / Down</span> to move · <span className="font-mono" dir="ltr">Enter</span> to open · <span className="font-mono" dir="ltr">Esc</span> to close
      </p>
    </Modal>
  );
}
