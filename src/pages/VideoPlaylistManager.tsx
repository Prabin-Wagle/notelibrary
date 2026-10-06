import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import axios from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';


const API_URL = 'https://notelibraryapp.com/api/admin';

interface VideoPlaylist {
  id: number;
  title: string;
  description: string;
  thumbnail: string;
  class_level: string;
  faculty: string;
  competitive_exam: string;
  subjects: string[];
  created_at: string;
}

export default function VideoPlaylistManager() {
  const { token } = useAuth();
  const [classes, setClasses] = useState<string[]>([]);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<VideoPlaylist | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnail: '',
    class_level: 'Class 10',
    faculty: 'None',
    competitive_exam: 'NONE',
    subjects: [] as string[]
  });

  useEffect(() => {
    fetchPlaylists();
    fetchAdminMetadata();
  }, [token]);

  const fetchAdminMetadata = async () => {
    if (!token) return;
    try {
      // Fetch Classes and Faculties
      const initRes = await axios.get('https://notelibraryapp.com/api/admin/subjects.php', {
        params: { action: 'init' },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (initRes.data.success) {
        setClasses(initRes.data.classes.filter((c: string) => c.toLowerCase() !== 'none'));
        setFaculties(initRes.data.faculties.filter((f: string) => f.toLowerCase() !== 'none'));
      }

      // Fetch Exams
      const examRes = await axios.get('https://notelibraryapp.com/api/admin/subjects.php', {
        params: { action: 'exams' },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (examRes.data.success) {
        setExams(examRes.data.exams);
      }
    } catch (error) {
      console.error('Failed to fetch admin metadata:', error);
    }
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      if (formData.class_level) {
        const normalizedClass = formData.class_level.toLowerCase().replace(/\s+/g, '');
        const normalizedFaculty = formData.faculty ? formData.faculty.toLowerCase().replace(/\s+/g, '_') : 'none';
        const tableName = `${normalizedClass}_${normalizedFaculty}`;

        try {
          const response = await axios.get('https://notelibraryapp.com/api/admin/subjects.php', {
            params: { action: 'subjects', table: tableName },
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.success) {
            setAvailableSubjects(response.data.subjects.map((s: any) => s.subject_name));
          } else {
            setAvailableSubjects([]);
          }
        } catch (error) {
          console.error('Failed to fetch subjects:', error);
          setAvailableSubjects([]);
        }
      } else {
        setAvailableSubjects([]);
      }
    };

    fetchSubjects();
  }, [formData.class_level, formData.faculty, token]);

  const fetchPlaylists = async () => {
    try {
      const response = await axios.get(`${API_URL}/videoPlaylist.php`);
      if (response.data.success) {
        setPlaylists(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };

      if (name === 'class_level') {
        // If class is 8, 9, or 10, force faculty to 'None'
        if (['Class 8', 'Class 9', 'Class 10'].includes(value)) {
          next.faculty = 'None';
        } else {
          // Otherwise, default to 'Science' if it was 'None' or 'Class 10' specific
          // This ensures faculty is not 'None' for other classes unless explicitly set
          if (prev.faculty === 'None' || prev.class_level === 'Class 10') {
            next.faculty = 'Science';
          }
        }
        next.subjects = []; // Reset subjects when class_level changes
      } else if (name === 'faculty') {
        next.subjects = []; // Reset subjects when faculty changes
      }
      return next;
    });
  };

  const handleSubjectToggle = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingPlaylist) {
        await axios.put(`${API_URL}/videoPlaylist.php`, {
          ...formData,
          id: editingPlaylist.id
        });
      } else {
        await axios.post(`${API_URL}/videoPlaylist.php`, formData);
      }

      await fetchPlaylists();
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving playlist:', error);
      alert('Error saving playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (playlist: VideoPlaylist) => {
    setEditingPlaylist(playlist);
    setFormData({
      title: playlist.title,
      description: playlist.description,
      thumbnail: playlist.thumbnail,
      class_level: playlist.class_level,
      faculty: playlist.faculty,
      competitive_exam: playlist.competitive_exam,
      subjects: playlist.subjects || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this playlist? All associated videos will also be deleted.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/videoPlaylist.php?id=${id}`);
      await fetchPlaylists();
    } catch (error) {
      console.error('Error deleting playlist:', error);
      alert('Error deleting playlist');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      thumbnail: '',
      class_level: 'Class 10',
      faculty: 'None',
      competitive_exam: 'NONE',
      subjects: []
    });
    setEditingPlaylist(null);
  };




  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Video Playlists</h1>
            <p className="text-gray-600 mt-1">Manage video playlists for different classes and subjects</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Create Playlist
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map(playlist => (
            <div key={playlist.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <img
                src={playlist.thumbnail || 'https://via.placeholder.com/400x225?text=No+Thumbnail'}
                alt={playlist.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{playlist.title}</h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{playlist.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {playlist.class_level}
                    </span>
                    {playlist.faculty !== 'None' && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        {playlist.faculty}
                      </span>
                    )}
                    {playlist.competitive_exam !== 'NONE' && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                        {playlist.competitive_exam}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    <strong>Subjects:</strong> {(playlist.subjects || []).join(', ')}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(playlist)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(playlist.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingPlaylist ? 'Edit Playlist' : 'Create New Playlist'}
                </h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                  <input
                    type="url"
                    name="thumbnail"
                    value={formData.thumbnail}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <select
                      name="class_level"
                      value={formData.class_level}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {classes.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="Pass Out">Pass Out</option>
                    </select>
                  </div>

                  {!['Class 8', 'Class 9', 'Class 10'].includes(formData.class_level) && (
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
                      <select
                        name="faculty"
                        value={formData.faculty}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="None">None</option>
                        {faculties.map(fac => (
                          <option key={fac} value={fac}>{fac}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Competitive Exam</label>
                  <select
                    name="competitive_exam"
                    value={formData.competitive_exam}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="NONE">None</option>
                    {exams.map(exam => (
                      <option key={exam.id} value={exam.exam_name}>{exam.exam_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subjects (Select Multiple)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {availableSubjects.map(subject => (
                      <label key={subject} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.subjects.includes(subject)}
                          onChange={() => handleSubjectToggle(subject)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{subject}</span>
                      </label>
                    ))}
                  </div>
                  {formData.subjects.length === 0 && (
                    <p className="text-red-500 text-xs mt-1">Please select at least one subject</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || formData.subjects.length === 0}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : editingPlaylist ? 'Update Playlist' : 'Create Playlist'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
