import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Filter } from 'lucide-react';
import axios from 'axios';
import { DashboardLayout } from '../components/DashboardLayout';

const API_URL = 'https://notelibraryapp.com/api/admin';

interface Video {
  id: number;
  playlist_id: number;
  title: string;
  description: string;
  thumbnail: string;
  video_link: string;
  subject: string;
  playlist_title: string;
  created_at: string;
}

interface VideoPlaylist {
  id: number;
  title: string;
  subjects: string[];
  class_level: string;
  faculty: string;
}

export default function VideoManager() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterPlaylistId, setFilterPlaylistId] = useState<number>(0);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnail: '',
    video_link: '',
    playlist_id: 0,
    subject: ''
  });

  useEffect(() => {
    fetchPlaylists();
    fetchVideos();
  }, []);

  useEffect(() => {
    if (filterPlaylistId > 0) {
      fetchVideos(filterPlaylistId);
    } else {
      fetchVideos();
    }
  }, [filterPlaylistId]);

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

  const fetchVideos = async (playlistId?: number) => {
    try {
      const url = playlistId
        ? `${API_URL}/video.php?playlist_id=${playlistId}`
        : `${API_URL}/video.php`;
      const response = await axios.get(url);
      if (response.data.success) {
        setVideos(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'playlist_id' ? parseInt(value) : value,
      ...(name === 'playlist_id' && { subject: '' })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingVideo) {
        await axios.put(`${API_URL}/video.php`, {
          ...formData,
          id: editingVideo.id
        });
      } else {
        await axios.post(`${API_URL}/video.php`, formData);
      }

      await fetchVideos(filterPlaylistId > 0 ? filterPlaylistId : undefined);
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving video:', error);
      alert('Error saving video');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description,
      thumbnail: video.thumbnail,
      video_link: video.video_link,
      playlist_id: video.playlist_id,
      subject: video.subject
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/video.php?id=${id}`);
      await fetchVideos(filterPlaylistId > 0 ? filterPlaylistId : undefined);
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Error deleting video');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      thumbnail: '',
      video_link: '',
      playlist_id: 0,
      subject: ''
    });
    setEditingVideo(null);
  };

  const getPlaylistSubjects = () => {
    const playlist = playlists.find(p => p.id == formData.playlist_id);
    return playlist?.subjects || [];
  };

  const getSelectedPlaylist = () => {
    return playlists.find(p => p.id == formData.playlist_id);
  };

  const groupedVideos = videos.reduce((acc, video) => {
    const playlistTitle = video.playlist_title || 'Unknown Playlist';
    if (!acc[playlistTitle]) {
      acc[playlistTitle] = [];
    }
    acc[playlistTitle].push(video);
    return acc;
  }, {} as Record<string, Video[]>);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Video Manager</h1>
            <p className="text-gray-600 mt-1">Manage individual videos within playlists</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Video
          </button>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <Filter size={20} className="text-gray-600" />
          <select
            value={filterPlaylistId}
            onChange={(e) => setFilterPlaylistId(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={0}>All Playlists</option>
            {playlists.map(playlist => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.title}
              </option>
            ))}
          </select>
          {filterPlaylistId > 0 && (
            <button
              onClick={() => setFilterPlaylistId(0)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="space-y-8">
          {Object.entries(groupedVideos).map(([playlistTitle, playlistVideos]) => (
            <div key={playlistTitle} className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b pb-2">
                {playlistTitle}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({playlistVideos.length} video{playlistVideos.length !== 1 ? 's' : ''})
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {playlistVideos.map(video => (
                  <div key={video.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    <img
                      src={video.thumbnail || 'https://via.placeholder.com/400x225?text=No+Thumbnail'}
                      alt={video.title}
                      className="w-full h-36 object-cover"
                    />
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 flex-1 line-clamp-2">{video.title}</h3>
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full whitespace-nowrap">
                          {video.subject}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{video.description}</p>

                      <a
                        href={video.video_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline block mb-3 truncate"
                      >
                        {video.video_link}
                      </a>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(video)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(video.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {videos.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow-md">
              <p className="text-gray-500 text-lg">No videos found. Add your first video to get started!</p>
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingVideo ? 'Edit Video' : 'Add New Video'}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Playlist</label>
                  <select
                    name="playlist_id"
                    value={formData.playlist_id}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={0}>Select a playlist</option>
                    {playlists.map(playlist => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.title} ({playlist.class_level} - {playlist.faculty})
                      </option>
                    ))}
                  </select>
                </div>

                {formData.playlist_id > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a subject</option>
                      {getPlaylistSubjects().map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                    {getSelectedPlaylist() && (
                      <p className="text-xs text-gray-500 mt-1">
                        Available subjects from {getSelectedPlaylist()?.title}
                      </p>
                    )}
                  </div>
                )}

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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video Link</label>
                  <input
                    type="url"
                    name="video_link"
                    value={formData.video_link}
                    onChange={handleInputChange}
                    required
                    placeholder="YouTube or Google Drive link"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
                    disabled={loading || formData.playlist_id === 0}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : editingVideo ? 'Update Video' : 'Add Video'}
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
