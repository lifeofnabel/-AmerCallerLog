import { useEffect, useState, type FormEvent } from 'react';

import { CategoryPicker } from './CategoryPicker';
import { Bi, Button, Dialog, FieldLabel, TextInput, cx, inputClass } from './ui';
import { validateInput } from '@/services/applications';
import { STATUS_LABELS, type Application, type Category, type Status } from '@/types/application';
import { fromLocalInput, toLocalInput } from '@/utils/dates';
import { typingPhone } from '@/utils/phone';

export function EditDialog({
  app,
  onClose,
  onSave,
}: {
  app: Application | null;
  onClose: () => void;
  onSave: (app: Application, input: { name: string; phone: string; category: Category; details: string; receivedAt: Date }, status: Status) => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<Category>('passport');
  const [details, setDetails] = useState('');
  const [when, setWhen] = useState('');
  const [status, setStatus] = useState<Status>('open');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (app === null) return;
    setName(app.name);
    setPhone(app.phone);
    setCategory(app.category);
    setDetails(app.details);
    setWhen(toLocalInput(app.receivedAt));
    setStatus(app.status);
    setError(null);
  }, [app]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (app === null) return;
    const receivedAt = fromLocalInput(when);
    const problem = validateInput({ name, phone, category, details, receivedAt });
    if (problem !== null) return setError(problem);
    if (receivedAt === null) return setError('Datum/Uhrzeit fehlt · التاريخ مطلوب');
    setSaving(true);
    try {
      await onSave(app, { name, phone, category, details, receivedAt }, status);
      onClose();
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={app !== null}
      onClose={onClose}
      title={
        <span>
          <span className="num text-accent">#{app?.sequenceNumber}</span> <Bi de="bearbeiten" ar="تعديل" />
        </span>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-3.5">
        <div>
          <FieldLabel de="Kategorie" ar="الفئة" />
          <CategoryPicker value={category} onChange={setCategory} size="md" />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="edit-name" de="Name" ar="الاسم" />
            <TextInput id="edit-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <FieldLabel htmlFor="edit-phone" de="Telefon" ar="رقم الهاتف" />
            <TextInput id="edit-phone" type="tel" className="num" value={phone} onChange={(e) => setPhone(typingPhone(e.target.value))} />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="edit-details" de="Details" ar="تفاصيل الطلب" />
          <textarea
            id="edit-details"
            dir="auto"
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className={cx(inputClass, 'h-auto py-2')}
          />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="edit-when" de="Datum / Uhrzeit" ar="التاريخ" />
            <input id="edit-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={cx(inputClass, 'num')} />
          </div>
          <div>
            <FieldLabel htmlFor="edit-status" de="Status" ar="الحالة" />
            <select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputClass}>
              {(['open', 'completed', 'cancelled'] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s].de} · {STATUS_LABELS[s].ar}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error !== null && (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-[13px]">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Speichert …' : <Bi de="Speichern" ar="حفظ" />}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
