import { Link } from "react-router-dom";

function LoadingState() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#A6192E] border-t-transparent" />
    </div>
  );
}

function ErrorState({ message, backTo, backLabel }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link to={backTo} className="text-sm font-medium text-[#A6192E]">
        ← {backLabel}
      </Link>
      <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        {message}
      </div>
    </div>
  );
}

function NotFoundState({ backTo, backLabel, entityName }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link to={backTo} className="text-sm font-medium text-[#A6192E]">
        ← {backLabel}
      </Link>
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{entityName} not found</h1>
        <p className="mt-2 text-gray-600">
          The requested item is unavailable or has been removed.
        </p>
      </div>
    </div>
  );
}

export default function DetailPage({
  item,
  loading,
  error,
  backTo,
  backLabel,
  title,
  badge,
  subtitle,
  image,
  imageAlt,
  meta = [],
  additionalFields = [],
  children,
  entityName = "Item",
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} backTo={backTo} backLabel={backLabel} />;
  if (!item) return <NotFoundState backTo={backTo} backLabel={backLabel} entityName={entityName} />;

  return (
    <div className="bg-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Link
          to={backTo}
          className="inline-flex items-center text-sm font-medium text-[#A6192E] hover:underline"
        >
          ← {backLabel}
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.35fr_0.9fr] items-start">
          <section>
            {badge && (
              <div className="inline-flex rounded-full bg-[#A6192E]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#A6192E]">
                {badge}
              </div>
            )}

            <h1 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-3 text-gray-600 leading-7 whitespace-pre-line">
                {subtitle}
              </p>
            )}

            <div className="mt-6 space-y-6">{children}</div>

            {additionalFields.length > 0 && (
              <div className="mt-8 rounded-2xl border bg-gray-50 p-5">
                <h2 className="text-lg font-semibold text-gray-900">
                  Additional details
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {additionalFields.map((field) => (
                    <div key={field.label} className="rounded-xl bg-white p-4 border">
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        {field.label}
                      </div>
                      <div className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                        {field.value || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6">
            {image && (
              <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <img
                  src={image}
                  alt={imageAlt || title || "detail"}
                  className="w-full object-cover max-h-[380px]"
                />
              </div>
            )}

            {meta.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {meta.map((field) => (
                  <div
                    key={field.label}
                    className="rounded-2xl border bg-white p-4 shadow-sm"
                  >
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      {field.label}
                    </div>
                    <div className="mt-1 text-sm font-medium text-gray-900 whitespace-pre-line">
                      {field.value || "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}