import { FormEvent, useEffect, useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { api, apiMessage } from '../lib/api';

type Program = { id: number; name: string; program_type: string; competitive_exam?: string | null; faculty?: string | null; is_active: number };
type Subject = { id: number; program_id: number | null; program_name?: string | null; name: string; slug: string; is_active: number };

const CLASS_SUBJECTS: Record<number, { Science?: string[]; Management?: string[]; all?: string[] }> = {
  10: { all: ['Computer', 'English', 'Mathematics', 'Nepali', 'Science', 'Social'] },
  11: {
    Science: ['Biology', 'Chemistry', 'Computer Science', 'English', 'Mathematics', 'Nepali', 'Physics', 'Social Studies'],
    Management: ['Accounting', 'Computer Science', 'Economics', 'English', 'Finance', 'Mathematics', 'Nepali', 'Social Studies'],
  },
  12: {
    Science: ['Chemistry', 'Computer Science', 'English', 'Mathematics', 'Nepali', 'Physics', 'Social Studies'],
    Management: ['Business Studies', 'Computer Science', 'Economics', 'English', 'Finance', 'Mathematics', 'Nepali', 'Social Studies'],
  },
};

function suggestedSubjects(program: Program | undefined): string[] {
  if (!program) return [];
  const classNumber = program.name.match(/\bclass\s*(10|11|12)\b/i)?.[1];
  if (!classNumber) return [];
  const subjectsForClass = CLASS_SUBJECTS[Number(classNumber)];
  if (subjectsForClass.all) return subjectsForClass.all;
  if (program.faculty === 'Science') return subjectsForClass.Science ?? [];
  if (program.faculty === 'Management') return subjectsForClass.Management ?? [];
  return [...new Set([...(subjectsForClass.Science ?? []), ...(subjectsForClass.Management ?? [])])];
}

export default function ClassManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [program, setProgram] = useState({ name: '', program_type: 'school', competitive_exam: '', faculty: '' });
  const [subject, setSubject] = useState({ program_id: '', name: '' });
  const [subjectProgramFilter, setSubjectProgramFilter] = useState('');
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);

  const resetProgramForm = () => {
    setProgram({ name: '', program_type: 'school', competitive_exam: '', faculty: '' });
    setEditingProgramId(null);
  };

  const resetSubjectForm = () => {
    setSubject((current) => ({ program_id: current.program_id, name: '' }));
    setEditingSubjectId(null);
  };

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
      const payload = {
        ...program,
        competitive_exam: program.program_type === 'school' ? program.competitive_exam : '',
      };
      if (editingProgramId) {
        await api.put(`/admin/catalog/programs/${editingProgramId}`, payload);
      } else {
        await api.post('/admin/catalog/programs', payload);
      }
      toast.success(editingProgramId ? 'Program updated' : 'Program created');
      resetProgramForm();
      await load();
    } catch (error) { toast.error(apiMessage(error, 'Unable to create the program.')); }
  };

  const deleteProgram = async (item: Program) => {
    if (!window.confirm(`Delete “${item.name}”? Programs with subjects or academic levels cannot be deleted.`)) return;
    try {
      await api.delete(`/admin/catalog/programs/${item.id}`);
      if (editingProgramId === item.id) resetProgramForm();
      toast.success('Program deleted');
      await load();
    } catch (error) { toast.error(apiMessage(error, 'Unable to delete the program.')); }
  };

  const addSubject = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.program_id) {
      toast.error('Choose a program before adding a subject.');
      return;
    }
    try {
      const payload = { program_id: Number(subject.program_id), name: subject.name, slug: subject.name };
      if (editingSubjectId) {
        await api.put(`/admin/catalog/subjects/${editingSubjectId}`, payload);
      } else {
        await api.post('/admin/catalog/subjects', payload);
      }
      toast.success(editingSubjectId ? 'Subject updated' : 'Subject created');
      resetSubjectForm();
      await load();
    } catch (error) { toast.error(apiMessage(error, 'Unable to create the subject.')); }
  };

  const deleteSubject = async (item: Subject) => {
    if (!window.confirm(`Delete “${item.name}”? Subjects used by academic levels cannot be deleted.`)) return;
    try {
      await api.delete(`/admin/catalog/subjects/${item.id}`);
      if (editingSubjectId === item.id) resetSubjectForm();
      toast.success('Subject deleted');
      await load();
    } catch (error) { toast.error(apiMessage(error, 'Unable to delete the subject.')); }
  };

  const selectedProgram = programs.find((item) => String(item.id) === subject.program_id);
  const visibleSubjects = subjectProgramFilter === '__unassigned__'
    ? subjects.filter((item) => item.program_id === null)
    : subjectProgramFilter
      ? subjects.filter((item) => String(item.program_id) === subjectProgramFilter)
      : [];
  const subjectOptionsId = 'academic-subject-suggestions';

  return (
    <DashboardLayout>
      <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Curriculum</p><h2 className="mt-2 text-4xl font-semibold tracking-tight">Academic structure</h2><p className="mt-3 text-slate-600">Programs and reusable subject definitions. Levels, offerings and units use the same V2 catalog API.</p></header>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center gap-3"><BookOpen className="text-emerald-700" /><h3 className="text-xl font-semibold">Programs</h3></div>
          <form onSubmit={addProgram} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <input required value={program.name} onChange={(e) => setProgram({ ...program, name: e.target.value })} placeholder="Program name" aria-label="Program name" className="rounded-xl border px-3 py-2.5" />
            <select value={program.program_type} onChange={(e) => setProgram({ ...program, program_type: e.target.value, competitive_exam: e.target.value === 'school' ? program.competitive_exam : '' })} aria-label="Program type" className="rounded-xl border bg-white px-3 py-2.5">
              <option value="school">School curriculum</option>
              <option value="entrance">Competitive exam</option>
            </select>
            {program.program_type === 'school' && <><input list="competitive-exam-program-suggestions" value={program.competitive_exam} onChange={(e) => setProgram({ ...program, competitive_exam: e.target.value })} placeholder="Competitive exam (optional)" aria-label="Competitive exam (optional)" className="rounded-xl border px-3 py-2.5" /><datalist id="competitive-exam-program-suggestions">{programs.filter((item) => item.program_type === 'entrance').map((item) => <option key={item.id} value={item.name} />)}</datalist></>}
            <select value={program.faculty} onChange={(e) => setProgram({ ...program, faculty: e.target.value })} aria-label="Faculty (optional)" className="rounded-xl border bg-white px-3 py-2.5">
              <option value="">No faculty (optional)</option>
              <option value="Science">Science</option>
              <option value="Management">Management</option>
            </select>
            <div className="flex gap-2"><button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-white">{editingProgramId ? <Pencil size={16} /> : <Plus size={16} />}{editingProgramId ? 'Save changes' : 'Add program'}</button>{editingProgramId && <button type="button" onClick={resetProgramForm} aria-label="Cancel program edit" className="rounded-xl border px-3 text-slate-600"><X size={17} /></button>}</div>
          </form>
          <p className="mt-2 text-xs text-slate-500">Name is required. Competitive exam programs are their own exam; school programs can optionally link one. Faculty is optional.</p>
          <div className="mt-6 divide-y">{programs.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-semibold">{item.name}</p><p className="text-xs uppercase tracking-wide text-slate-500">{item.program_type === 'entrance' ? 'Competitive exam' : 'School curriculum'}{item.competitive_exam && item.program_type !== 'entrance' ? ` · Exam: ${item.competitive_exam}` : ''}{item.faculty ? ` · ${item.faculty}` : ''}</p></div><div className="flex shrink-0 items-center gap-3"><span className="text-xs text-emerald-700">{Number(item.is_active) ? 'Active' : 'Hidden'}</span><button type="button" onClick={() => { setProgram({ name: item.name, program_type: item.program_type, competitive_exam: item.program_type === 'school' ? item.competitive_exam || '' : '', faculty: item.faculty || '' }); setEditingProgramId(item.id); }} aria-label={`Edit ${item.name}`} title="Edit program" className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"><Pencil size={15} /></button><button type="button" onClick={() => deleteProgram(item)} aria-label={`Delete ${item.name}`} title="Delete program" className="rounded-lg border p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button></div></div>)}</div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center gap-3"><BookOpen className="text-emerald-700" /><h3 className="text-xl font-semibold">Subjects</h3></div>
          <form onSubmit={addSubject} className="grid gap-3 sm:grid-cols-3">
            <select required value={subjectProgramFilter} onChange={(e) => { const value = e.target.value; setSubject({ ...subject, program_id: value === '__unassigned__' ? '' : value }); setSubjectProgramFilter(value); }} aria-label="Program and subject filter" className="rounded-xl border bg-white px-3 py-2.5">
              <option value="">Select a program</option>
              {programs.filter((item) => Number(item.is_active)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              <option value="__unassigned__">Unassigned legacy subjects</option>
            </select>
            <input required list={subjectOptionsId} value={subject.name} onChange={(e) => setSubject({ ...subject, name: e.target.value })} placeholder="Subject name or suggestion" aria-label="Subject name" className="rounded-xl border px-3 py-2.5" />
            <datalist id={subjectOptionsId}>{suggestedSubjects(selectedProgram).map((name) => <option key={name} value={name} />)}</datalist>
            <div className="flex gap-2"><button disabled={!subject.program_id} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-50">{editingSubjectId ? <Pencil size={16} /> : <Plus size={16} />}{editingSubjectId ? 'Save changes' : 'Add subject'}</button>{editingSubjectId && <button type="button" onClick={resetSubjectForm} aria-label="Cancel subject edit" className="rounded-xl border px-3 text-slate-600"><X size={17} /></button>}</div>
          </form>
          <p className="mt-2 text-xs text-slate-500">Choose a program to view only its subjects. Class 10–12 suggestions adapt to the selected program’s faculty; you can still enter a custom subject. Unassigned legacy records remain available from the last option.</p>
          {!subjectProgramFilter ? <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">Select a program above to view its subjects.</div> : visibleSubjects.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">No subjects are saved for {subjectProgramFilter === '__unassigned__' ? 'the unassigned legacy group' : programs.find((item) => String(item.id) === subjectProgramFilter)?.name ?? 'this program'} yet.</div> : <div className="mt-6 divide-y">{visibleSubjects.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-slate-500">{item.program_name || 'Unassigned legacy subject'}</p></div><div className="flex shrink-0 items-center gap-3"><span className="text-xs text-emerald-700">{Number(item.is_active) ? 'Active' : 'Hidden'}</span><button type="button" onClick={() => { const programId = item.program_id ? String(item.program_id) : ''; setSubject({ program_id: programId, name: item.name }); setSubjectProgramFilter(programId || '__unassigned__'); setEditingSubjectId(item.id); }} aria-label={`Edit ${item.name}`} title="Edit subject" className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"><Pencil size={15} /></button><button type="button" onClick={() => deleteSubject(item)} aria-label={`Delete ${item.name}`} title="Delete subject" className="rounded-lg border p-2 text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button></div></div>)}</div>}
        </section>
      </div>
    </DashboardLayout>
  );
}
