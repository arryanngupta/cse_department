import { useEffect, useState } from 'react';
import { adminAPI } from '../../lib/api.js';

const initialForm = {
  title: '',
  page_group: 'general',
  block_type: 'rich_text',
  subtitle: '',
  description: '',
  cta_text: '',
  cta_url: '',
  content_html: '',
  content_json: '',
  display_order: 0,
  is_active: true
};

export default function OpportunitiesManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    try {
      const resp = await adminAPI.getOpportunities();
      setItems(resp.data?.data || []);
    } catch (error) {
      console.error(error);
      alert('Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }

  function openForm(item = null) {
    if (item) {
      setEditingId(item.id);
      setForm({
        title: item.title || '',
        page_group: item.page_group || 'general',
        block_type: item.block_type || 'rich_text',
        subtitle: item.subtitle || '',
        description: item.description || '',
        cta_text: item.cta_text || '',
        cta_url: item.cta_url || '',
        content_html: item.content_html || '',
        content_json: item.content_json ? JSON.stringify(item.content_json, null, 2) : '',
        display_order: item.display_order ?? 0,
        is_active: item.is_active ?? true
      });
    } else {
      setEditingId(null);
      setForm(initialForm);
    }
    setImageFile(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
    setImageFile(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) data.append(key, value);
    });

    if (imageFile) data.append('image', imageFile);

    try {
      if (editingId) {
        await adminAPI.updateOpportunity(editingId, data);
        alert('Opportunity updated successfully');
      } else {
        await adminAPI.createOpportunity(data);
        alert('Opportunity created successfully');
      }
      closeForm();
      fetchItems();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to save opportunity');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await adminAPI.deleteOpportunity(id);
      alert('Deleted successfully');
      fetchItems();
    } catch (error) {
      console.error(error);
      alert('Failed to delete item');
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Opportunities Management</h1>
        <button onClick={() => openForm()} className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800">
          Add Opportunity
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Group</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Order</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm font-medium">{item.title}</td>
                <td className="px-4 py-3 text-sm">{item.page_group}</td>
                <td className="px-4 py-3 text-sm">{item.block_type}</td>
                <td className="px-4 py-3 text-sm">{item.display_order}</td>
                <td className="px-4 py-3 text-sm">{item.is_active ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-3 text-sm space-x-3">
                  <button onClick={() => openForm(item)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">{editingId ? 'Edit Opportunity' : 'Add Opportunity'}</h2>
              <button onClick={closeForm} className="text-gray-500 hover:text-gray-900">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <input className="input-field md:col-span-2" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />

              <select className="input-field" value={form.page_group} onChange={(e) => setForm({ ...form, page_group: e.target.value })}>
                <option value="faculty">Faculty</option>
                <option value="research">Research</option>
                <option value="non_academic">Non-academic</option>
                <option value="general">General</option>
              </select>

              <select className="input-field" value={form.block_type} onChange={(e) => setForm({ ...form, block_type: e.target.value })}>
                <option value="hero">Hero</option>
                <option value="accordion">Accordion</option>
                <option value="table">Table</option>
                <option value="button_group">Button Group</option>
                <option value="links">Links</option>
                <option value="note">Note</option>
                <option value="rich_text">Rich Text</option>
              </select>

              <input className="input-field" placeholder="Subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              <input className="input-field" type="number" placeholder="Display Order" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
              <input className="input-field" placeholder="CTA Text" value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} />
              <input className="input-field" placeholder="CTA URL" value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} />

              <textarea className="input-field md:col-span-2" rows={4} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <textarea className="input-field md:col-span-2" rows={5} placeholder="Content HTML" value={form.content_html} onChange={(e) => setForm({ ...form, content_html: e.target.value })} />
              <textarea className="input-field md:col-span-2 font-mono text-sm" rows={10} placeholder='JSON for tables / accordion / links / buttons' value={form.content_json} onChange={(e) => setForm({ ...form, content_json: e.target.value })} />

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Image</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>

              <label className="md:col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active
              </label>

              <div className="md:col-span-2 flex gap-3 pt-2">
                <button type="submit" className="bg-red-700 text-white px-5 py-2 rounded hover:bg-red-800">
                  Save
                </button>
                <button type="button" onClick={closeForm} className="bg-gray-200 px-5 py-2 rounded hover:bg-gray-300">
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
