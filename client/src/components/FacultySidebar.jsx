import { Mail, Globe, Calendar, Building2 } from "lucide-react";

export default function FacultySidebar({ faculty }) {
  const formatDate = (d) => {
    if (!d) return "N/A";
    try {
      return new Date(d).toLocaleDateString("en-GB");
    } catch {
      return d;
    }
  };

  return (
    <aside className="lg:col-span-1">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

        {/* 🔥 Profile Image */}
        <div className="relative w-full h-64 bg-gray-100">
          <img
            src={faculty.photo || faculty.photo_path || "/placeholder-profile.png"}
            alt={faculty.name}
            className="w-full h-full object-cover"
          />

          {/* subtle overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        {/* 🔥 Content */}
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            {faculty.name}
          </h2>

          <p className="text-lnmiit-red font-semibold mt-1 text-sm">
            {faculty.designation}
          </p>

          {/* 🔥 Divider */}
          <div className="my-4 border-t border-gray-100" />

          {/* 🔥 Info */}
          <div className="space-y-3 text-sm text-gray-700">

            {faculty.email && (
              <div className="flex items-start gap-2">
                <Mail size={16} className="text-gray-500 mt-[2px]" />
                <a
                  href={`mailto:${faculty.email}`}
                  className="hover:text-lnmiit-red transition"
                >
                  {faculty.email}
                </a>
              </div>
            )}

            {faculty.website && (
              <div className="flex items-start gap-2">
                <Globe size={16} className="text-gray-500 mt-[2px]" />
                <a
                  href={faculty.website}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-lnmiit-red transition"
                >
                  Website
                </a>
              </div>
            )}

            {faculty.joining_date && (
              <div className="flex items-start gap-2">
                <Calendar size={16} className="text-gray-500 mt-[2px]" />
                {formatDate(faculty.joining_date)}
              </div>
            )}

            {faculty.department && (
              <div className="flex items-start gap-2">
                <Building2 size={16} className="text-gray-500 mt-[2px]" />
                {faculty.department}
              </div>
            )}
          </div>

          {/* 🔥 Links */}
          {(faculty.orcid || faculty.scopus || faculty.linkedin) && (
            <>
              <div className="my-5 border-t border-gray-100" />

              <div className="flex flex-wrap gap-2">
                {faculty.orcid && (
                  <a
                    href={faculty.orcid}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200 transition"
                  >
                    ORCID
                  </a>
                )}

                {faculty.scopus && (
                  <a
                    href={faculty.scopus}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200 transition"
                  >
                    Scopus
                  </a>
                )}

                {faculty.linkedin && (
                  <a
                    href={faculty.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200 transition"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}