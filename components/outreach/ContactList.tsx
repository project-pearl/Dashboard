'use client';

import { useState, useEffect } from 'react';
import { csrfHeaders } from '@/lib/csrf';
import type { OutreachContact } from '@/lib/outreach/types';

export default function ContactList() {
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    fetch('/api/outreach/contacts')
      .then(r => r.json())
      .then(d => setContacts(d.contacts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addContact = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/outreach/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          name,
          email,
          title: title || undefined,
          organization: organization || undefined,
          state: state || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContacts([...contacts, data.contact]);
        setName('');
        setEmail('');
        setTitle('');
        setOrganization('');
        setState('');
        setShowForm(false);
      } else {
        setError(data.error || 'Failed to add contact');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading contacts...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Contacts ({contacts.length})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          {showForm ? 'Cancel' : 'Add Contact'}
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      {/* Add contact form */}
      {showForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="jane@example.gov"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Environmental Program Manager"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Organization</label>
              <input
                value={organization}
                onChange={e => setOrganization(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="State DEQ"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
              <input
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="CA"
                maxLength={2}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={addContact}
              disabled={saving || !name.trim() || !email.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </div>
      )}

      {/* Contact table */}
      {contacts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No contacts yet. Add your first contact to start building campaigns.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Title</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Organization</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">State</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(contact => (
                <tr key={contact.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 px-3 text-gray-900 dark:text-white">{contact.name}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{contact.email}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{contact.title || '—'}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{contact.organization || '—'}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{contact.state || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
