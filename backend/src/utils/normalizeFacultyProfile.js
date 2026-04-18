export function normalizeFacultyProfile(person) {
  const sections = [];

  /* ================= PERSONAL INFORMATION ================= */
  sections.push({
    title: "Personal Information",
    type: "table",
    columns: ["Field", "Details"],
    data: [
      ["Name", person.name || "—"],
      ["Designation", person.designation || "—"],
      ["Department", person.department || "—"],
      ["Email", person.email || "—"],
      ["Phone", person.phone || "—"]
    ],
  });

  /* ================= ADMIN SECTIONS ================= */

  if (Array.isArray(person.profile_sections)) {
    person.profile_sections.forEach((section) => {
      /* ================= CASE 1: NORMAL STRUCTURE ================= */
      if (section?.title && section?.type) {
        sections.push({
          title: section.title,
          type: section.type,
          columns: section.columns || [],
          data: section.data ?? section.items ?? section.content ?? ""
        });
        return;
      }

      /* ================= CASE 2: YOUR JSON STRUCTURE ================= */
      Object.entries(section).forEach(([key, value]) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return;

        const title = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        if (Array.isArray(value) && typeof value[0] === "object") {
          const columns = Object.keys(value[0]);

          sections.push({
            title,
            type: "table",
            columns,
            data: value.map((obj) => columns.map((col) => obj[col] ?? "—"))
          });
        } else if (Array.isArray(value)) {
          sections.push({
            title,
            type: "list",
            data: value
          });
        } else {
          sections.push({
            title,
            type: "text",
            data: value
          });
        }
      });
    });
  }

  return {
    name: person.name,
    slug: person.slug,
    designation: person.designation,
    department: person.department,
    email: person.email,
    phone: person.phone,
    website: person.webpage,
    photo: person.photo_path,
    joining_date: person.joining_date,

    summary: person.summary || "",
    biography: person.bio || "",
    research_area: person.research_areas || "",

    profile_sections: Array.isArray(person.profile_sections)
      ? person.profile_sections
      : [],

    sections,
  };
}