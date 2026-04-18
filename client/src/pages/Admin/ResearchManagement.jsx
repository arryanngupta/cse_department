import { useState, useEffect } from "react";
import { adminAPI } from "../../lib/api.js";

const EMPTY_FORM = {
  title: "",
  category: "",
  description: "",
  link: "",
  is_featured: false,
  display_order: 0,

  // Publication
  authors: "",
  journal: "",
  year: "",

  // Project
  faculty: "",
  funding_agency: "",
  funding_amount: "",
  duration: "",
  pi_co_pi: "",
  status: "",

  // Patent
  inventors: "",
  application_no: "",
  patent_status: "",

  // Collaboration
  collaboration_org: "",
};

const EMPTY_BLOCKS = () => [];

export default function ResearchManagement() {
  const [researchList, setResearchList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingResearch, setEditingResearch] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [blocks, setBlocks] = useState(EMPTY_BLOCKS());

  useEffect(() => {
    fetchResearch();
  }, []);

  const fetchResearch = async () => {
    try {
      const res = await adminAPI.getResearch();
      setResearchList(res.data.data || []);
    } catch (err) {
      alert("Failed to load research");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item?.id) {
      setEditingResearch(item);

      const {
        id,
        content_json,
        createdAt,
        updatedAt,
        image_path,
        ...safeItem
      } = item || {};

      setFormData({
        ...EMPTY_FORM,
        ...safeItem,
      });

      setBlocks(
        normalizeBlocks(content_json).map((b) => ({
          _id: Date.now() + Math.random(),
          ...b,
        })),
      );
    } else {
      setEditingResearch(null);
      setFormData({
        ...EMPTY_FORM,
        ...(item?.category ? { category: item.category } : {}),
      });
      setBlocks(EMPTY_BLOCKS());
    }

    setImageFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingResearch(null);
    setFormData({ ...EMPTY_FORM });
    setImageFile(null);
    setBlocks(EMPTY_BLOCKS());
  };

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const addBlock = (type) => {
    const newBlock = createDefaultBlock(type);
    setBlocks((prev) => [...prev, newBlock]);
  };

  const updateBlock = (id, patch) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block._id === id
          ? { ...block, ...patch }
          : block,
      ),
    );
  };

  const removeBlock = (id) => {
    setBlocks((prev) => prev.filter((block) => block._id !== id));
  };

  const moveBlock = (index, direction) => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;

      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;

      return next;
    });
  };

  const addAccordionItem = (blockIndex) => {
    setBlocks((prev) =>
      prev.map((block, i) =>
        i === blockIndex
          ? {
              ...block,
              items: [
                ...(Array.isArray(block.items) ? block.items : []),
                { heading: "", text: "" },
              ],
            }
          : block,
      ),
    );
  };

  const updateAccordionItem = (blockIndex, itemIndex, patch) => {
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== blockIndex) return block;

        const items = Array.isArray(block.items) ? [...block.items] : [];
        if (!items[itemIndex]) return block;

        items[itemIndex] = {
          ...items[itemIndex],
          ...patch,
        };

        return {
          ...block,
          items,
        };
      }),
    );
  };

  const removeAccordionItem = (blockIndex, itemIndex) => {
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== blockIndex) return block;

        const items = Array.isArray(block.items) ? [...block.items] : [];
        items.splice(itemIndex, 1);

        return {
          ...block,
          items,
        };
      }),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();

    Object.entries(formData).forEach(([k, v]) => {
      if (v !== null && v !== "") data.append(k, v);
    });

    data.append("content_json", JSON.stringify(blocks ?? []));

    if (imageFile) data.append("image", imageFile);

    try {
      if (editingResearch?.id) {
        await adminAPI.updateResearch(editingResearch.id, data);
        alert("Research updated");
      } else {
        await adminAPI.createResearch(data);
        alert("Research created");
      }
      fetchResearch();
      closeModal();
    } catch (err) {
      alert("Failed to save research");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this research item?")) return;
    await adminAPI.deleteResearch(id);
    fetchResearch();
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-700" />
      </div>
    );

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Research</h1>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => openModal({ category: "Publication" })}
            className="btn-primary"
          >
            + Publication
          </button>
          <button
            type="button"
            onClick={() => openModal({ category: "Project" })}
            className="btn-primary"
          >
            + Project
          </button>
          <button
            type="button"
            onClick={() => openModal({ category: "Patent" })}
            className="btn-primary"
          >
            + Patent
          </button>
          <button
            type="button"
            onClick={() => openModal({ category: "Collaboration" })}
            className="btn-primary"
          >
            + Collaboration
          </button>
        </div>
      </div>

      <table className="w-full bg-white shadow rounded">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Title</th>
            <th className="p-3 text-left">Category</th>
            <th className="p-3">Featured</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {researchList.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-3">{r.title}</td>
              <td className="p-3">{r.category}</td>
              <td className="p-3 text-center">
                {r.is_featured ? "Yes" : "No"}
              </td>
              <td className="p-3 space-x-3">
                <button onClick={() => openModal(r)} className="text-blue-600">
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg w-full max-w-4xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-6">
              {editingResearch ? "Edit Research" : "Add Research"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Title *"
                value={formData.title}
                onChange={(v) => handleChange("title", v)}
                required
              />

              <Select
                label="Category *"
                value={formData.category}
                onChange={(v) => handleChange("category", v)}
                options={["Publication", "Project", "Patent", "Collaboration"]}
                required
              />

              {formData.category === "Publication" && (
                <>
                  <Input
                    label="Authors"
                    value={formData.authors}
                    onChange={(v) => handleChange("authors", v)}
                  />
                  <Input
                    label="Journal / Conference"
                    value={formData.journal}
                    onChange={(v) => handleChange("journal", v)}
                  />
                  <Input
                    label="Year"
                    value={formData.year}
                    onChange={(v) => handleChange("year", v)}
                  />
                </>
              )}

              {formData.category === "Project" && (
                <>
                  <Input
                    label="Principal Investigator"
                    value={formData.faculty}
                    onChange={(v) => handleChange("faculty", v)}
                  />
                  <Input
                    label="Funding Agency"
                    value={formData.funding_agency}
                    onChange={(v) => handleChange("funding_agency", v)}
                  />
                  <Input
                    label="Funding Amount"
                    value={formData.funding_amount}
                    onChange={(v) => handleChange("funding_amount", v)}
                  />
                  <Input
                    label="Duration"
                    value={formData.duration}
                    onChange={(v) => handleChange("duration", v)}
                  />
                  <Input
                    label="PI / Co-PI"
                    value={formData.pi_co_pi}
                    onChange={(v) => handleChange("pi_co_pi", v)}
                  />
                  <Input
                    label="Status"
                    value={formData.status}
                    onChange={(v) => handleChange("status", v)}
                  />
                  <Textarea
                    label="Description"
                    value={formData.description}
                    onChange={(v) => handleChange("description", v)}
                  />
                </>
              )}

              {formData.category === "Patent" && (
                <>
                  <Input
                    label="Inventors"
                    value={formData.inventors}
                    onChange={(v) => handleChange("inventors", v)}
                  />
                  <Input
                    label="Application No."
                    value={formData.application_no}
                    onChange={(v) => handleChange("application_no", v)}
                  />
                  <Input
                    label="Patent Status"
                    value={formData.patent_status}
                    onChange={(v) => handleChange("patent_status", v)}
                  />
                </>
              )}

              {formData.category === "Collaboration" && (
                <Input
                  label="Organization Name"
                  value={formData.collaboration_org}
                  onChange={(v) => handleChange("collaboration_org", v)}
                />
              )}

              <Input
                label="Link (optional)"
                value={formData.link}
                onChange={(v) => handleChange("link", v)}
              />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Research Media Image (optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </div>

              <label className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={formData.is_featured}
                  onChange={(e) =>
                    handleChange("is_featured", e.target.checked)
                  }
                />
                Featured Research
              </label>

              <Input
                label="Display Order"
                type="number"
                value={formData.display_order}
                onChange={(v) => handleChange("display_order", v)}
              />

              <div className="border-t pt-6 mt-6">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h3 className="text-xl font-semibold">Content Blocks</h3>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => addBlock("text")}
                      className="btn-secondary"
                    >
                      + Text
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock("image")}
                      className="btn-secondary"
                    >
                      + Image
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock("table")}
                      className="btn-secondary"
                    >
                      + Table
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock("accordion")}
                      className="btn-secondary"
                    >
                      + Accordion
                    </button>
                  </div>
                </div>

                {blocks.length === 0 ? (
                  <div className="text-sm text-gray-500 mb-2">
                    No content blocks added yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {blocks.map((block, idx) => (
                      <div
                        key={block._id}
                        className="border rounded-lg p-4 bg-gray-50"
                      >
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="font-semibold uppercase text-sm text-gray-700">
                            {block.type}
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => moveBlock(idx, -1)}
                              className="text-sm text-blue-600"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBlock(idx, 1)}
                              className="text-sm text-blue-600"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBlock(block._id)}
                              className="text-sm text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {block.type === "text" && (
                          <div className="space-y-3">
                            <Input
                              label="Block Title"
                              value={block.title || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { title: v })
                              }
                            />
                            <Textarea
                              label="Block Content"
                              value={block.content || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { content: v })
                              }
                            />
                          </div>
                        )}

                        {block.type === "image" && (
                          <div className="space-y-3">
                            <Input
                              label="Block Title"
                              value={block.title || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { title: v })
                              }
                            />
                            <Input
                              label="Image URL"
                              value={block.src || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { src: v })
                              }
                            />
                            <Input
                              label="Alt Text"
                              value={block.alt || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { alt: v })
                              }
                            />
                            <Input
                              label="Caption"
                              value={block.caption || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { caption: v })
                              }
                            />
                          </div>
                        )}

                        {block.type === "table" && (
                          <div className="space-y-3">
                            <Input
                              label="Table Title"
                              value={block.title || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { title: v })
                              }
                            />

                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Columns (comma separated)
                              </label>
                              <input
                                value={(block.columns || []).join(", ")}
                                onChange={(e) =>
                                  updateBlock(block._id, {
                                    columns: e.target.value
                                      .split(",")
                                      .map((s) => s.trim()),
                                  })
                                }
                                className="input-field"
                                placeholder="Title, Funding Agency, PI, Funding, Duration, Status"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Rows (one row per line, values comma separated)
                              </label>
                              <textarea
                                rows={7}
                                value={(block.rows || [])
                                  .map((row) => row.join(", "))
                                  .join("\n")}
                                onChange={(e) => {
                                  const rows = e.target.value
                                    .split("\n")
                                    .filter((line) => line.trim() !== "")
                                    .map((line) =>
                                      line.split(",").map((s) => s.trim()),
                                    );

                                  updateBlock(block._id, { rows });
                                }}
                                className="input-field"
                                placeholder="AI in Healthcare, DST India, Dr. XYZ, ₹10,00,000, 2022-2025, Ongoing"
                              />
                            </div>
                          </div>
                        )}

                        {block.type === "accordion" && (
                          <div className="space-y-3">
                            <Input
                              label="Accordion Title"
                              value={block.title || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { title: v })
                              }
                            />
                            <Textarea
                              label="Accordion Intro Content"
                              value={block.content || ""}
                              onChange={(v) =>
                                updateBlock(block._id, { content: v })
                              }
                            />

                            <div className="flex justify-between items-center mt-4">
                              <div className="font-medium">Accordion Items</div>
                              <button
                                type="button"
                                onClick={() => addAccordionItem(idx)}
                                className="text-sm text-blue-600"
                              >
                                + Add Item
                              </button>
                            </div>

                            <div className="space-y-3">
                              {(Array.isArray(block.items)
                                ? block.items
                                : []
                              ).map((item, itemIndex) => (
                                <div
                                  key={itemIndex}
                                  className="border rounded-md p-3 bg-white"
                                >
                                  <div className="flex justify-between mb-3">
                                    <div className="text-sm font-semibold">
                                      Item {itemIndex + 1}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeAccordionItem(idx, itemIndex)
                                      }
                                      className="text-sm text-red-600"
                                    >
                                      Delete
                                    </button>
                                  </div>

                                  <div className="space-y-3">
                                    <Input
                                      label="Heading"
                                      value={item.heading || ""}
                                      onChange={(v) =>
                                        updateAccordionItem(idx, itemIndex, {
                                          heading: v,
                                        })
                                      }
                                    />
                                    <Textarea
                                      label="Text"
                                      value={item.text || ""}
                                      onChange={(v) =>
                                        updateAccordionItem(idx, itemIndex, {
                                          text: v,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Save
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
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
}

const Input = ({ label, value, onChange, type = "text", required }) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    <input
      type={type}
      value={value || ""}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
    />
  </div>
);

const Textarea = ({ label, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    <textarea
      rows={4}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
    />
  </div>
);

const Select = ({ label, value, onChange, options, required }) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    <select
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
    >
      <option value="">Select</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

function normalizeBlocks(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === "object") return [value];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (!parsed) return [];

      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  return [];
}

function createDefaultBlock(type) {
  const base = {
    _id: Date.now() + Math.random(),
    type,
  };

  if (type === "text") {
    return {
      ...base,
      title: "",
      content: "",
    };
  }

  if (type === "image") {
    return {
      ...base,
      title: "",
      src: "",
      alt: "",
      caption: "",
    };
  }

  if (type === "table") {
    return {
      ...base,
      title: "",
      columns: ["Column 1"],
      rows: [[""]],
    };
  }

  if (type === "accordion") {
    return {
      ...base,
      title: "",
      content: "",
      items: [{ heading: "", text: "" }],
    };
  }

  return {
    ...base,
    title: "",
    content: "",
  };
}