import { useState, useEffect, useRef } from "react";
import { adminAPI, authAPI, publicAPI } from "../../lib/api.js";

const PeopleManagement = () => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [user, setUser] = useState(null);
  const hasAutoOpenedRef = useRef(false);

  const emptyForm = {
    name: "",
    person_type: "Faculty",
    designation: "",
    email: "",
    phone: "",
    department: "Computer Science & Engineering",
    webpage: "",
    summary: "",
    research_areas: "",
    joining_date: "",
    bio: "",
    order: 0,
    profile_sections: [],
  };

  const [formData, setFormData] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [jsonText, setJsonText] = useState("[]");
  const [jsonError, setJsonError] = useState("");

  const mapFacultyProfileToPerson = (facultyData) => {
    return {
      id: facultyData?.id ?? user?.facultyProfileId ?? null,
      slug: facultyData?.slug ?? "",
      name: facultyData?.name ?? user?.name ?? "",
      person_type: facultyData?.person_type ?? "Faculty",
      designation: facultyData?.designation ?? "",
      email: facultyData?.email ?? "",
      phone: facultyData?.phone ?? "",
      department: facultyData?.department ?? "Computer Science & Engineering",
      webpage: facultyData?.webpage ?? "",
      summary: facultyData?.summary ?? "",
      research_areas:
        facultyData?.research_areas ??
        facultyData?.researchArea ??
        facultyData?.research_area ??
        "",
      joining_date: facultyData?.joining_date ?? "",
      bio: facultyData?.bio ?? facultyData?.biography ?? "",
      order: facultyData?.order ?? 0,
      photo_path: facultyData?.photo_path ?? "",
      profile_sections: Array.isArray(facultyData?.profile_sections)
        ? facultyData.profile_sections
        : [],
    };
  };

  const fetchPeople = async (currentUser = user) => {
    try {
      setLoading(true);

      if (currentUser?.role === "faculty") {
        const slug = currentUser?.facultyProfile?.slug;

        if (!slug) {
          setPeople([]);
          return;
        }

        const res = await publicAPI.getPersonBySlug(slug);
        const facultyData = res?.data?.data || null;

        if (facultyData) {
          setPeople([mapFacultyProfileToPerson(facultyData)]);
        } else {
          setPeople([]);
        }
      } else {
        const res = await adminAPI.getPeople();
        setPeople(res.data.data || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      alert("Failed to fetch people");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await authAPI.getMe();
        setUser(res.data.data);
      } catch (err) {
        console.error("User fetch failed:", err);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPeople(user);
    }
  }, [user]);

  useEffect(() => {
    if (
      user?.role === "faculty" &&
      people.length === 1 &&
      !hasAutoOpenedRef.current
    ) {
      hasAutoOpenedRef.current = true;
      openModal(people[0]);
    }
  }, [user, people]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (jsonError) {
      alert("Fix JSON error first");
      return;
    }

    const data = new FormData();

    const profileSections = (
      Array.isArray(formData.profile_sections) ? formData.profile_sections : []
    ).filter((section) => section.title !== "Personal Information");

    Object.entries(formData).forEach(([key, value]) => {
      if (key === "profile_sections") {
        data.append(key, JSON.stringify(profileSections));
      } else {
        data.append(key, value ?? "");
      }
    });

    if (photoFile) data.append("photo", photoFile);

    try {
      if (editingPerson) {
        const response = await adminAPI.updatePerson(editingPerson.id, data);
        const savedPerson = response?.data?.data || null;

        if (user?.role === "faculty" && savedPerson) {
          setPeople([mapFacultyProfileToPerson(savedPerson)]);

          const meRes = await authAPI.getMe();
          setUser(meRes.data.data);
        } else {
          await fetchPeople(user);
        }

        alert("Person updated successfully");
      } else {
        await adminAPI.createPerson(data);
        await fetchPeople(user);
        alert("Person created successfully");
      }

      closeModal();
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save person");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure?")) return;

    try {
      await adminAPI.deletePerson(id);
      await fetchPeople(user);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Delete failed");
    }
  };

  const openModal = (person = null) => {
    if (person) {
      setEditingPerson(person);

      let sections = [];

      if (person.profile_sections) {
        if (typeof person.profile_sections === "string") {
          try {
            sections = JSON.parse(person.profile_sections);
          } catch {
            sections = [];
          }
        } else if (Array.isArray(person.profile_sections)) {
          sections = person.profile_sections;
        }
      }

      setFormData({
        ...emptyForm,
        ...person,
        joining_date: person.joining_date?.split("T")[0] || "",
        profile_sections: sections,
      });

      setJsonText(JSON.stringify(sections, null, 2));
    } else {
      setEditingPerson(null);
      setFormData(emptyForm);
      setJsonText("[]");
    }

    setPhotoFile(null);
    setJsonError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPerson(null);
    setFormData(emptyForm);
    setPhotoFile(null);
    setJsonText("[]");
    setJsonError("");
  };

  const handleJsonChange = (value) => {
    setJsonText(value);

    try {
      const parsed = JSON.parse(value);
      const cleaned = Array.isArray(parsed)
        ? parsed.filter((section) => section.title !== "Personal Information")
        : [];
      setFormData((prev) => ({ ...prev, profile_sections: cleaned }));
      setJsonError("");
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  const getSectionsCount = (person) => {
    if (!person.profile_sections) return 0;

    if (typeof person.profile_sections === "string") {
      try {
        return JSON.parse(person.profile_sections).length || 0;
      } catch {
        return 0;
      }
    }

    return Array.isArray(person.profile_sections)
      ? person.profile_sections.length
      : 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-lnmiit-red" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            People Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage faculty and other people records.
          </p>
        </div>

        {user?.role !== "faculty" && (
          <button
            onClick={() => openModal()}
            className="rounded-lg bg-lnmiit-red px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Add Person
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Photo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Designation
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sections
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {people.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    {person.photo_path ? (
                      <img
                        src={person.photo_path}
                        alt={person.name}
                        className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-500">
                        No Photo
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-slate-900">
                    {person.name}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-700">
                    {person.person_type}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-700">
                    {person.designation}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-700">
                    {person.email}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-700">
                    {getSectionsCount(person)} sections
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-3 text-sm">
                      <button
                        onClick={() => {
                          if (
                            user?.role === "faculty" &&
                            person.id !== user.facultyProfileId
                          ) {
                            alert("You can only edit your own profile");
                            return;
                          }
                          openModal(person);
                        }}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>

                      {user?.role !== "faculty" && !person.user_id && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await adminAPI.createFacultyLogin(
                                person.id,
                              );
                              const { email, tempPassword } = res.data.data;

                              alert(
                                `Faculty login created successfully.\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease copy it now.`,
                              );

                              await fetchPeople(user);
                            } catch (err) {
                              alert(
                                err.response?.data?.error ||
                                  "Failed to create faculty login",
                              );
                            }
                          }}
                          className="font-medium text-green-600 hover:text-green-700"
                        >
                          Generate Login
                        </button>
                      )}

                      {user?.role !== "faculty" && (
                        <button
                          onClick={() => handleDelete(person.id)}
                          className="font-medium text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {people.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No people found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingPerson ? "Edit Person" : "Add Person"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
              <Input
                label="Name"
                value={formData.name}
                onChange={(v) => setFormData({ ...formData, name: v })}
                required
              />

              <Input
                label="Department"
                value={formData.department}
                onChange={(v) => setFormData({ ...formData, department: v })}
              />

              <Input
                label="Webpage"
                value={formData.webpage}
                onChange={(v) => setFormData({ ...formData, webpage: v })}
              />

              <Input
                type="date"
                label="Joining Date"
                value={formData.joining_date}
                onChange={(v) => setFormData({ ...formData, joining_date: v })}
              />

              <Input
                label="Order"
                value={formData.order}
                onChange={(v) => setFormData({ ...formData, order: v })}
              />

              <Field label="Summary">
                <textarea
                  value={formData.summary || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, summary: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-lnmiit-red"
                  rows={4}
                />
              </Field>

              <Field label="Biography">
                <textarea
                  value={formData.bio || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-lnmiit-red"
                  rows={6}
                />
              </Field>

              <Field label="Research Areas">
                <textarea
                  value={formData.research_areas || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      research_areas: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-lnmiit-red"
                  rows={3}
                />
              </Field>

              <Field label="Person Type">
                <select
                  value={formData.person_type}
                  onChange={(e) =>
                    setFormData({ ...formData, person_type: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-lnmiit-red"
                >
                  <option value="Faculty">Faculty</option>
                  <option value="Staff">Staff</option>
                  <option value="Research Scholar">Research Scholar</option>
                  <option value="Alumni">Prominent Alumni</option>
                </select>
              </Field>

              <Input
                label="Designation"
                value={formData.designation}
                onChange={(v) => setFormData({ ...formData, designation: v })}
              />

              <Input
                label="Email"
                value={formData.email}
                onChange={(v) => setFormData({ ...formData, email: v })}
              />

              <Input
                label="Phone"
                value={formData.phone}
                onChange={(v) => setFormData({ ...formData, phone: v })}
              />

              <Input type="file" label="Photo" onFile={setPhotoFile} />

              <Field label="Profile Sections (JSON)">
                <textarea
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none transition focus:border-lnmiit-red"
                  rows={8}
                />

                {jsonError && (
                  <p className="mt-1 text-sm text-red-600">{jsonError}</p>
                )}
              </Field>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-lnmiit-red px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  {editingPerson ? "Update" : "Create"}
                </button>

                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleManagement;

const Field = ({ label, children }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-slate-700">
      {label}
    </label>
    {children}
  </div>
);

const Input = ({ label, value, onChange, type = "text", onFile, required }) => (
  <Field label={label}>
    {type === "file" ? (
      <input
        type="file"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
      />
    ) : (
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-lnmiit-red"
        required={required}
      />
    )}
  </Field>
);