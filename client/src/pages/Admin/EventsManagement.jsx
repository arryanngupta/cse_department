// src/admin/pages/EventsManagement.jsx

import { useState, useEffect } from 'react';
import { adminAPI } from '../../lib/api.js';

const EventsManagement = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const EMPTY_FORM = {
    title: '',
    startsAt: '',
    endsAt: '',
    venue: '',
    description: '',
    link: '',
    isPublished: true
  };

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [bannerFile, setBannerFile] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await adminAPI.getEvents();

      // 🔥 SORT LATEST FIRST (extra safety)
      const sorted = (response.data.data || []).sort(
        (a, b) => new Date(b.startsAt) - new Date(a.startsAt)
      );

      setEvents(sorted);
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();

    Object.keys(formData).forEach(key => {
      if (formData[key] !== '') {
        data.append(key, formData[key]);
      }
    });

    if (bannerFile) data.append('banner', bannerFile);

    try {
      if (editingEvent) {
        await adminAPI.updateEvent(editingEvent.id, data);
        alert('Event updated successfully!');
      } else {
        await adminAPI.createEvent(data);
        alert('Event created successfully!');
      }

      fetchEvents();
      closeModal();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Failed to save event');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return;

    await adminAPI.deleteEvent(id);
    fetchEvents();
  };

  const openModal = (event = null) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        startsAt: event.startsAt.slice(0, 16),
        endsAt: event.endsAt ? event.endsAt.slice(0, 16) : '',
        venue: event.venue || '',
        description: event.description || '',
        link: event.link || '',
        isPublished: event.isPublished
      });
    } else {
      setEditingEvent(null);
      setFormData(EMPTY_FORM);
    }

    setBannerFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEvent(null);
    setFormData(EMPTY_FORM);
    setBannerFile(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div className="flex justify-center py-12">
      <div className="animate-spin h-10 w-10 border-b-2 border-red-700 rounded-full"></div>
    </div>;
  }

  return (
    <div>

      {/* HEADER */}
      <div className="flex justify-between mb-8">
        <h1 className="text-3xl font-bold">Events</h1>
        <button onClick={() => openModal()} className="btn-primary">
          Add Event
        </button>
      </div>

      {/* TABLE */}
      <table className="w-full bg-white shadow rounded">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Title</th>
            <th className="p-3 text-left">Starts</th>
            <th className="p-3 text-left">Venue</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>

        <tbody>
          {events.map(e => (
            <tr key={e.id} className="border-t">
              <td className="p-3">{e.title}</td>
              <td className="p-3">{formatDate(e.startsAt)}</td>
              <td className="p-3">{e.venue}</td>
              <td className="p-3">
                {e.isPublished ? "Published" : "Draft"}
              </td>
              <td className="p-3 space-x-3">
                <button onClick={() => openModal(e)}>Edit</button>
                <button onClick={() => handleDelete(e.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL SAME AS YOUR ORIGINAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
          <div className="bg-white p-8 w-full max-w-xl rounded">

            <h2 className="text-xl mb-4">
              {editingEvent ? "Edit Event" : "Add Event"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">

              <input placeholder="Title"
                value={formData.title}
                onChange={e => setFormData({...formData, title:e.target.value})}
                className="input-field"
                required
              />

              <input type="datetime-local"
                value={formData.startsAt}
                onChange={e => setFormData({...formData, startsAt:e.target.value})}
                className="input-field"
                required
              />

              <input type="datetime-local"
                value={formData.endsAt}
                onChange={e => setFormData({...formData, endsAt:e.target.value})}
                className="input-field"
              />

              <input placeholder="Venue"
                value={formData.venue}
                onChange={e => setFormData({...formData, venue:e.target.value})}
                className="input-field"
              />

              <textarea placeholder="Description"
                value={formData.description}
                onChange={e => setFormData({...formData, description:e.target.value})}
                className="input-field"
              />

              <input placeholder="Link"
                value={formData.link}
                onChange={e => setFormData({...formData, link:e.target.value})}
                className="input-field"
              />

              <input type="file" onChange={e => setBannerFile(e.target.files[0])} />

              <label>
                <input type="checkbox"
                  checked={formData.isPublished}
                  onChange={e => setFormData({...formData, isPublished:e.target.checked})}
                /> Published
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

export default EventsManagement;