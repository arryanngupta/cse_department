// src/admin/pages/AchievementsManagement.jsx

import { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api.js';

const AchievementsManagement = () => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState(null);

  const [filter, setFilter] = useState("all"); // 🔥 NEW FILTER

  const EMPTY_FORM = {
    title: '',
    category: 'student',
    students: '',
    description: '',
    link: '',
    isPublished: true,
  };

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const response = await adminAPI.getAchievements();
      setAchievements(response.data.data || []);
    } catch (error) {
      console.error(error);
      alert('Failed to fetch achievements');
    } finally {
      setLoading(false);
    }
  };

  const filteredAchievements =
    filter === "all"
      ? achievements
      : achievements.filter(a => a.category === filter);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();

    Object.entries(formData).forEach(([k, v]) => {
      if (v !== undefined && v !== null) data.append(k, v);
    });

    if (imageFile) data.append('image', imageFile);

    if (editingAchievement) {
      await adminAPI.updateAchievement(editingAchievement.id, data);
    } else {
      await adminAPI.createAchievement(data);
    }

    fetchAchievements();
    closeModal();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this achievement?")) return;
    await adminAPI.deleteAchievement(id);
    fetchAchievements();
  };

  const openModal = (a = null) => {
    if (a) {
      setEditingAchievement(a);
      setFormData({
        title: a.title,
        category: a.category || 'student',
        students: a.students || '',
        description: a.description || '',
        link: a.link || '',
        isPublished: a.isPublished,
      });
    } else {
      setEditingAchievement(null);
      setFormData(EMPTY_FORM);
    }

    setImageFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAchievement(null);
    setFormData(EMPTY_FORM);
    setImageFile(null);
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div>

      {/* HEADER */}
      <div className="flex justify-between mb-6">
        <h1 className="text-3xl font-bold">Achievements</h1>
        <button onClick={() => openModal()} className="btn-primary">
          Add Achievement
        </button>
      </div>

      {/* 🔥 FILTER */}
      <div className="mb-4 flex gap-3">
        {["all", "student", "faculty"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1 rounded border ${
              filter === f ? "bg-red-700 text-white" : ""
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 text-left">Title</th>
            <th className="p-3">Category</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>

        <tbody>
          {filteredAchievements.map(a => (
            <tr key={a.id} className="border-t">
              <td className="p-3">{a.title}</td>
              <td className="p-3 capitalize">{a.category}</td>
              <td className="p-3">
                {a.isPublished ? "Published" : "Draft"}
              </td>
              <td className="p-3 space-x-2">
                <button onClick={() => openModal(a)}>Edit</button>
                <button onClick={() => handleDelete(a.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
          <div className="bg-white p-6 rounded w-full max-w-xl">

            <form onSubmit={handleSubmit} className="space-y-4">

              <input
                className="input-field"
                placeholder="Title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />

              <select
                className="input-field"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>

              <textarea
                className="input-field"
                placeholder="Names"
                value={formData.students}
                onChange={(e) =>
                  setFormData({ ...formData, students: e.target.value })
                }
              />

              <textarea
                className="input-field"
                placeholder="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />

              <input
                className="input-field"
                placeholder="Link"
                value={formData.link}
                onChange={(e) =>
                  setFormData({ ...formData, link: e.target.value })
                }
              />

              <input
                type="file"
                onChange={(e) => setImageFile(e.target.files[0])}
              />

              <label>
                <input
                  type="checkbox"
                  checked={formData.isPublished}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isPublished: e.target.checked,
                    })
                  }
                />
                Published
              </label>

              <div className="flex gap-4">
                <button className="btn-primary flex-1">Save</button>
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
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

export default AchievementsManagement;