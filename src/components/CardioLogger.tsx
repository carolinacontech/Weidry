import { useState } from 'react';
import { db } from '../lib/db';
import { today } from '../lib/dates';
import { Button, Chip, Field, inputClass, useToast } from './ui';

const ACTIVITIES = ['Caminata rápida', 'Bicicleta', 'Elíptica', 'Baile', 'Natación', 'Otro'];

export function CardioLogger({ date = today(), onSaved }: { date?: string; onSaved?: () => void }) {
  const toast = useToast();
  const [minutes, setMinutes] = useState(30);
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [d, setD] = useState(date);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!minutes || minutes <= 0) {
      toast('Indica los minutos', 'error');
      return;
    }
    setSaving(true);
    try {
      await db.cardio.add({ date: d, minutes, activity });
      toast(`+${minutes} min de cardio guardados`);
      onSaved?.();
    } catch {
      toast('No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Minutos rápidos">
        {[10, 20, 30, 45, 60].map((m) => (
          <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)}>
            {m} min
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Minutos">
          {(id) => <input id={id} className={inputClass} type="number" inputMode="numeric" min={1} max={300} value={minutes || ''} onChange={(e) => setMinutes(Number(e.target.value))} />}
        </Field>
        <Field label="Fecha">
          {(id) => <input id={id} className={inputClass} type="date" value={d} onChange={(e) => setD(e.target.value)} />}
        </Field>
      </div>
      <Field label="Actividad">
        {(id) => (
          <select id={id} className={inputClass} value={activity} onChange={(e) => setActivity(e.target.value)}>
            {ACTIVITIES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        )}
      </Field>
      <Button onClick={save} loading={saving}>
        Guardar cardio
      </Button>
    </div>
  );
}
