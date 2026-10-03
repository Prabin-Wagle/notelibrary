import { FormEvent, useEffect, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { api, apiMessage } from '../lib/api';

type Program = { id: number; code: string; name: string; program_type: string; is_active: number };
type Subject = { id: number; code?: string; name: string; slug: string; is_active: number };

export default function ClassManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [program, setProgram] = useState({ code: '', name: '', program_type: 'school' });
  const [subject, setSubject] = useState({ code: '', name: '', slug: '' });

  const load = async () => {
    try {
      const [programResponse, subjectResponse] = await Promise.all([
        api.get('/admin/catalog/programs'),
        api.get('/admin/catalog/subjects'),
      ]);
      setPrograms(programResponse.data.data.programs);
      setSubjects(subjectResponse.data.data.subjects);
    } catch (error) { toast.error(apiMessage(error, 'Unable to load the academic catalog.')); }
  };

  useEffect(() => { load(); }, []);

  const addProgram = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/admin/catalog/programs', program);
      setProgram({ code: '', name: '', program_type: 'school' });
      toast.success('Program created');
      await load();
    } catch (error) { toast.error(apiMessage(error, 'Unable to create the program.')); }
  };

  const addSubject = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/admin/catalog/subjects', { ...subject, slug: subject.slug || subject.name });
      setSubject({ code: '', name: '', slug: '' });
      toast.success('Subject created');
      await load();
    } catch (error) { toast.error(apiMessage(error, 'Unable to create the subject.')); }
  };

  return (
    <DashboardLayout>
      <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Curriculum</p><h2 className="mt-2 text-4xl font-semibold tracking-tight">Academic structure</h2><p className="mt-3 text-slate-600">Programs and reusable subject definitions. Levels, offerings and units use the same V2 catalog API.</p></header>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-center gap-3"><BookOpen className="text-emerald-700" /><h3 className="text-xl font-semibold">Programs</h3></div><form onSubmit={addProgram} className="grid gap-3 sm:grid-cols-3"><input required value={program.code} onChange={(e) => setProgram({ ...program, code: e.target.value })} placeholder="Code" className="rounded-xl border px-3 py-2.5" /><input required value={program.name} onChange={(e) => setProgram({ ...program, name: e.target.value })} placeholder="Program name" className="rounded-xl border px-3 py-2.5" /><button className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-white"><Plus size={16} />Add</button></form><div className="mt-6 divide-y">{programs.map((item) => <div key={item.id} className="flex items-center justify-between py-4"><div><p className="font-semibold">{item.name}</p><p className="text-xs uppercase tracking-wide text-slate-500">{item.code} · {item.program_type}</p></div><span className="text-xs text-emerald-700">{Number(item.is_active) ? 'Active' : 'Hidden'}</span></div>)}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-center gap-3"><BookOpen className="text-emerald-700" /><h3 className="text-xl font-semibold">Subjects</h3></div><form onSubmit={addSubject} className="grid gap-3 sm:grid-cols-3"><input value={subject.code} onChange={(e) => setSubject({ ...subject, code: e.target.value })} placeholder="Code" className="rounded-xl border px-3 py-2.5" /><input required value={subject.name} onChange={(e) => setSubject({ ...subject, name: e.target.value })} placeholder="Subject name" className="rounded-xl border px-3 py-2.5" /><button className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-white"><Plus size={16} />Add</button></form><div className="mt-6 divide-y">{subjects.map((item) => <div key={item.id} className="flex items-center justify-between py-4"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-slate-500">/{item.slug}</p></div><span className="text-xs text-emerald-700">{Number(item.is_active) ? 'Active' : 'Hidden'}</span></div>)}</div></section>
      </div>
    </DashboardLayout>
  );
}
