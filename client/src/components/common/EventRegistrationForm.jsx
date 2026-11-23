import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Users } from 'lucide-react';
import { publicAPI } from '../../lib/api';

/**
 * Public registration form for an event.
 *
 * Renders nothing until the status probe confirms the event accepts
 * registrations, so past and non-registration events are unaffected.
 * Server-side validation is authoritative; the checks here only avoid an
 * obviously-pointless round trip.
 */
export default function EventRegistrationForm({ eventId }) {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    affiliation: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!eventId) return;
    publicAPI
      .eventRegistrationStatus(eventId)
      .then((res) => setStatus(res.data?.data || null))
      .catch(() => setStatus(null));
  }, [eventId]);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!form.name.trim() || !form.email.trim()) {
      setFieldErrors({
        name: form.name.trim() ? undefined : 'Please enter your name',
        email: form.email.trim() ? undefined : 'Please enter your email',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await publicAPI.registerForEvent(eventId, form);
      setResult(res.data?.data || { message: 'Registration received.' });
    } catch (err) {
      const data = err?.response?.data;

      // The API returns per-field details for validation failures.
      if (Array.isArray(data?.details)) {
        setFieldErrors(
          Object.fromEntries(data.details.map((d) => [d.field, d.message])),
        );
        setError('Please correct the highlighted fields.');
      } else {
        setError(data?.error || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Not open, or the probe failed: show nothing rather than a dead form.
  if (!status?.open) return null;

  if (result) {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
          <div>
            <h2 className="font-semibold text-green-900">
              {result.status === 'waitlisted' ? 'Added to waitlist' : 'You are registered'}
            </h2>
            <p className="mt-1 text-sm text-green-800">{result.message}</p>
          </div>
        </div>
      </section>
    );
  }

  const inputClass = (key) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-[#8B0000]/20 ${
      fieldErrors[key]
        ? 'border-red-400 focus:border-red-500'
        : 'border-gray-300 focus:border-[#8B0000]'
    }`;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Register for this event</h2>
          {status.deadline && (
            <p className="mt-1 text-sm text-gray-600">
              Registration closes{' '}
              {new Date(status.deadline).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        {status.capacity !== null && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            <Users className="h-3.5 w-3.5" />
            {status.remaining > 0
              ? `${status.remaining} of ${status.capacity} places left`
              : 'Full — waitlist only'}
          </span>
        )}
      </div>

      {status.full && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          This event is full. You can still register and will be added to the
          waitlist.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <div>
          <label htmlFor="reg-name" className="mb-1 block text-sm font-medium text-gray-700">
            Name <span className="text-red-600">*</span>
          </label>
          <input
            id="reg-name"
            value={form.name}
            onChange={update('name')}
            maxLength={160}
            required
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'reg-name-error' : undefined}
            className={inputClass('name')}
          />
          {fieldErrors.name && (
            <p id="reg-name-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-gray-700">
            Email <span className="text-red-600">*</span>
          </label>
          <input
            id="reg-email"
            type="email"
            value={form.email}
            onChange={update('email')}
            maxLength={160}
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
            className={inputClass('email')}
          />
          {fieldErrors.email && (
            <p id="reg-email-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="reg-phone" className="mb-1 block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            id="reg-phone"
            value={form.phone}
            onChange={update('phone')}
            maxLength={32}
            aria-invalid={Boolean(fieldErrors.phone)}
            className={inputClass('phone')}
          />
          {fieldErrors.phone && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="reg-affiliation"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Institution / Organisation
          </label>
          <input
            id="reg-affiliation"
            value={form.affiliation}
            onChange={update('affiliation')}
            maxLength={160}
            className={inputClass('affiliation')}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="reg-notes" className="mb-1 block text-sm font-medium text-gray-700">
            Anything we should know?
          </label>
          <textarea
            id="reg-notes"
            value={form.notes}
            onChange={update('notes')}
            rows={3}
            maxLength={2000}
            className={inputClass('notes')}
          />
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-[#8B0000] px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-[#6d0000] disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Submitting…' : status.full ? 'Join waitlist' : 'Register'}
          </button>

          <p className="mt-2 text-xs text-gray-500">
            Your details are used only to manage attendance for this event and
            are not published.
          </p>
        </div>
      </form>
    </section>
  );
}
