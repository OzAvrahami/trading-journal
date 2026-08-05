import { useEffect, useState } from 'react';
import { Check, Plus, X } from '@phosphor-icons/react';
import { Button } from '../ui/Button.jsx';
import { Checkbox, Field, Input } from '../ui/FormControls.jsx';

export const EMOTION_SUGGESTIONS = ['Focused', 'Patient', 'Confident', 'Calm', 'Anxious', 'Frustrated', 'FOMO'];
export const MISTAKE_SUGGESTIONS = ['Overtrading', 'Chased entry', 'Moved stop', 'Oversized risk', 'Revenge trade', 'Early exit'];

function normalizeItems(values) {
  const seen = new Set();
  return values.map((value) => value.trim()).filter((value) => {
    if (!value) return false;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ChipField({ legend, suggestions, values, onChange }) {
  const [custom, setCustom] = useState('');
  const selected = new Set(values.map((value) => value.toLocaleLowerCase()));
  function toggle(value) {
    const key = value.toLocaleLowerCase();
    onChange(selected.has(key) ? values.filter((item) => item.toLocaleLowerCase() !== key) : normalizeItems([...values, value]).slice(0, 10));
  }
  function addCustom() {
    const value = custom.trim();
    if (!value || value.length > 48 || values.length >= 10) return;
    onChange(normalizeItems([...values, value]).slice(0, 10));
    setCustom('');
  }
  return (
    <fieldset className="space-y-2">
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((value) => {
          const isSelected = selected.has(value.toLocaleLowerCase());
          return (
            <button key={value} type="button" aria-pressed={isSelected} onClick={() => toggle(value)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm ${isSelected ? 'border-action bg-action-soft font-semibold text-action' : 'border-default bg-surface-raised text-secondary hover:border-strong'}`}>
              {isSelected && <Check size={14} weight="bold" aria-hidden="true" />}{value}
            </button>
          );
        })}
        {values.filter((value) => !suggestions.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())).map((value) => (
          <button key={value.toLocaleLowerCase()} type="button" aria-pressed="true" aria-label={`Remove ${value}`} onClick={() => toggle(value)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-action bg-action-soft px-3 text-sm font-semibold text-action">
            {value}<X size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 adaptive:flex-row">
        <Input value={custom} maxLength={48} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom(); } }} placeholder={`Add custom ${legend.toLowerCase().replace(/s$/, '')}`} aria-label={`Custom ${legend.toLowerCase()}`} />
        <Button type="button" size="mobile" disabled={!custom.trim() || values.length >= 10} onClick={addCustom} leadingIcon={<Plus size={16} aria-hidden="true" />}>Add</Button>
      </div>
      <p className="text-xs text-muted" dir="ltr">{values.length}/10 selected</p>
    </fieldset>
  );
}

const blank = { content: '', wentWell: '', improve: '', nextSessionPlan: '', emotions: [], mistakes: [], isComplete: false };

export function DailyReviewForm({ review, date, onSubmit, saving = false }) {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  useEffect(() => {
    setForm(review ? {
      content: review.content ?? '', wentWell: review.wentWell ?? '', improve: review.improve ?? '',
      nextSessionPlan: review.nextSessionPlan ?? '', emotions: review.emotions ?? [], mistakes: review.mistakes ?? [],
      isComplete: Boolean(review.isComplete),
    } : blank);
    setError('');
  }, [review, date]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function submit(event) {
    event.preventDefault();
    if (!form.content.trim()) { setError('Session notes are required.'); return; }
    setError('');
    onSubmit({
      content: form.content.trim(), wentWell: form.wentWell.trim() || null,
      improve: form.improve.trim() || null, nextSessionPlan: form.nextSessionPlan.trim() || null,
      emotions: normalizeItems(form.emotions), mistakes: normalizeItems(form.mistakes), isComplete: form.isComplete,
    });
  }
  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <Field label="Session notes" required error={error} helpText="Stored as the canonical Daily Review Journal content.">
        {(props) => <textarea {...props} data-autofocus rows={5} maxLength={10000} className="input min-h-32 resize-y" value={form.content} onChange={(event) => set('content', event.target.value)} />}
      </Field>
      <div className="grid gap-4 adaptive:grid-cols-2">
        <Field label="What went well">{(props) => <textarea {...props} rows={4} maxLength={2000} className="input min-h-24 resize-y" value={form.wentWell} onChange={(event) => set('wentWell', event.target.value)} />}</Field>
        <Field label="What should improve">{(props) => <textarea {...props} rows={4} maxLength={2000} className="input min-h-24 resize-y" value={form.improve} onChange={(event) => set('improve', event.target.value)} />}</Field>
      </div>
      <Field label="Next-session plan">{(props) => <textarea {...props} rows={4} maxLength={2000} className="input min-h-24 resize-y" value={form.nextSessionPlan} onChange={(event) => set('nextSessionPlan', event.target.value)} />}</Field>
      <ChipField legend="Emotions" suggestions={EMOTION_SUGGESTIONS} values={form.emotions} onChange={(value) => set('emotions', value)} />
      <ChipField legend="Mistakes" suggestions={MISTAKE_SUGGESTIONS} values={form.mistakes} onChange={(value) => set('mistakes', value)} />
      <div className="flex flex-col gap-3 border-t border-default pt-4 adaptive:flex-row adaptive:items-center adaptive:justify-between">
        <Checkbox label="Mark this Daily Review complete" checked={form.isComplete} onChange={(event) => set('isComplete', event.target.checked)} />
        <Button type="submit" variant="primary" size="mobile" loading={saving}>Save Daily Review</Button>
      </div>
    </form>
  );
}
