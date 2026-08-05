import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

function ChipField({ legend, customLabel, suggestions, values, onChange }) {
  const { t } = useTranslation();
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
          <button key={value.toLocaleLowerCase()} type="button" aria-pressed="true" aria-label={`${t('common.delete')} ${value}`} onClick={() => toggle(value)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-action bg-action-soft px-3 text-sm font-semibold text-action">
            {value}<X size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 adaptive:flex-row">
        <Input value={custom} maxLength={48} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom(); } }} placeholder={customLabel} aria-label={customLabel} />
        <Button type="button" size="mobile" disabled={!custom.trim() || values.length >= 10} onClick={addCustom} leadingIcon={<Plus size={16} aria-hidden="true" />}>{t('dailyReview.add')}</Button>
      </div>
      <p className="text-xs text-muted" dir="ltr">{values.length}/10 {t('common.selected').toLocaleLowerCase()}</p>
    </fieldset>
  );
}

const blank = { content: '', wentWell: '', improve: '', nextSessionPlan: '', emotions: [], mistakes: [], isComplete: false };

export function DailyReviewForm({ review, date, onSubmit, saving = false }) {
  const { t } = useTranslation();
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
    if (!form.content.trim()) { setError(t('dailyReview.contentRequired')); return; }
    setError('');
    onSubmit({
      content: form.content.trim(), wentWell: form.wentWell.trim() || null,
      improve: form.improve.trim() || null, nextSessionPlan: form.nextSessionPlan.trim() || null,
      emotions: normalizeItems(form.emotions), mistakes: normalizeItems(form.mistakes), isComplete: form.isComplete,
    });
  }
  const emotionSuggestions = t('dailyReview.emotionSuggestions', { returnObjects: true });
  const mistakeSuggestions = t('dailyReview.mistakeSuggestions', { returnObjects: true });
  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <Field label={t('dailyReview.sessionNotes')} required error={error} helpText={t('dailyReview.noReviewDetail')}>
        {(props) => <textarea {...props} data-autofocus rows={5} maxLength={10000} className="input min-h-32 resize-y" value={form.content} onChange={(event) => set('content', event.target.value)} />}
      </Field>
      <div className="grid gap-4 adaptive:grid-cols-2">
        <Field label={t('dailyReview.wentWell')}>{(props) => <textarea {...props} rows={4} maxLength={2000} className="input min-h-24 resize-y" value={form.wentWell} onChange={(event) => set('wentWell', event.target.value)} />}</Field>
        <Field label={t('dailyReview.improve')}>{(props) => <textarea {...props} rows={4} maxLength={2000} className="input min-h-24 resize-y" value={form.improve} onChange={(event) => set('improve', event.target.value)} />}</Field>
      </div>
      <Field label={t('dailyReview.nextPlan')}>{(props) => <textarea {...props} rows={4} maxLength={2000} className="input min-h-24 resize-y" value={form.nextSessionPlan} onChange={(event) => set('nextSessionPlan', event.target.value)} />}</Field>
      <ChipField legend={t('dailyReview.emotions')} customLabel={t('dailyReview.customEmotion')} suggestions={emotionSuggestions} values={form.emotions} onChange={(value) => set('emotions', value)} />
      <ChipField legend={t('dailyReview.mistakes')} customLabel={t('dailyReview.customMistake')} suggestions={mistakeSuggestions} values={form.mistakes} onChange={(value) => set('mistakes', value)} />
      <div className="flex flex-col gap-3 border-t border-default pt-4 adaptive:flex-row adaptive:items-center adaptive:justify-between">
        <Checkbox label={t('dailyReview.completion')} checked={form.isComplete} onChange={(event) => set('isComplete', event.target.checked)} />
        <Button type="submit" variant="primary" size="mobile" loading={saving}>{t('dailyReview.saveReview')}</Button>
      </div>
    </form>
  );
}
