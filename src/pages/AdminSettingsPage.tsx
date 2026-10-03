import { FormEvent, useEffect, useState } from 'react';
import { Loader2, Save, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { api, apiMessage } from '../lib/api';

type Settings = {
  workspace: { name: string; support_email: string; timezone: string };
  content: { default_visibility: string; allow_student_bookmarks: boolean; maintenance_mode: boolean };
  uploads: { max_file_size_mb: number; allowed_types: string[] };
};

const defaults: Settings = {
  workspace: { name: 'Note Library', support_email: 'support@notelibraryapp.com', timezone: 'Asia/Kathmandu' },
  content: { default_visibility: 'authenticated', allow_student_bookmarks: true, maintenance_mode: false },
  uploads: { max_file_size_mb: 25, allowed_types: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm'] },
};

export const AdminSettingsPage = () => {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/legacy/settings').then(({ data }) => {
      setSettings({ ...defaults, ...(data.data?.settings || {}) });
    }).catch((reason) => setError(apiMessage(reason, 'Unable to load workspace settings.')))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const { data } = await api.post('/admin/legacy/settings', { settings });
      setSettings({ ...defaults, ...(data.data?.settings || settings) });
      toast.success('Settings saved');
    } catch (reason) { setError(apiMessage(reason, 'Unable to save settings.')); }
    finally { setSaving(false); }
  };

  const update = <K extends keyof Settings>(section: K, value: Partial<Settings[K]>) =>
    setSettings((current) => ({ ...current, [section]: { ...current[section], ...value } }));

  return <DashboardLayout>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">ADMINISTRATION</span><h2>Workspace settings</h2><p>Manage the shared student experience, publishing defaults, and upload limits.</p></div><span className="admin-heading-icon"><Settings2 /></span></header>
    {error && <div role="alert" className="admin-alert-error">{error}</div>}
    {loading ? <div className="admin-loading"><Loader2 className="animate-spin" /> Loading settings…</div> : <form className="admin-settings-form" onSubmit={save}>
      <section className="admin-settings-section"><div><h3>Workspace identity</h3><p>Contact and regional details used across the platform.</p></div><div className="admin-settings-fields">
        <label>Workspace name<input required maxLength={120} value={settings.workspace.name} onChange={(e) => update('workspace', { name: e.target.value })} /></label>
        <label>Support email<input required type="email" value={settings.workspace.support_email} onChange={(e) => update('workspace', { support_email: e.target.value })} /></label>
        <label>Timezone<select value={settings.workspace.timezone} onChange={(e) => update('workspace', { timezone: e.target.value })}><option>Asia/Kathmandu</option><option>Asia/Kolkata</option><option>UTC</option></select></label>
      </div></section>
      <section className="admin-settings-section"><div><h3>Student content</h3><p>Choose how new learning materials are published.</p></div><div className="admin-settings-fields">
        <label>Default visibility<select value={settings.content.default_visibility} onChange={(e) => update('content', { default_visibility: e.target.value })}><option value="authenticated">Signed-in students</option><option value="public">Public</option></select></label>
        <label className="admin-toggle-row"><span><strong>Allow bookmarks</strong><small>Students can save resources to their library.</small></span><input type="checkbox" checked={settings.content.allow_student_bookmarks} onChange={(e) => update('content', { allow_student_bookmarks: e.target.checked })} /></label>
        <label className="admin-toggle-row"><span><strong>Maintenance mode</strong><small>Keep student access closed during planned maintenance.</small></span><input type="checkbox" checked={settings.content.maintenance_mode} onChange={(e) => update('content', { maintenance_mode: e.target.checked })} /></label>
      </div></section>
      <section className="admin-settings-section"><div><h3>Uploads</h3><p>Limits enforced by the media upload API.</p></div><div className="admin-settings-fields">
        <label>Maximum file size (MB)<input type="number" min={1} max={100} value={settings.uploads.max_file_size_mb} onChange={(e) => update('uploads', { max_file_size_mb: Number(e.target.value) })} /></label>
        <p className="admin-settings-hint">Supported formats: PDF, JPG, PNG, WebP, GIF, MP4 and WebM.</p>
      </div></section>
      <div className="admin-settings-actions"><span>Changes apply to the shared Note Library database.</span><button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />} Save settings</button></div>
    </form>}
  </DashboardLayout>;
};
