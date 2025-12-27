import React, { useState } from 'react';
import { User, Briefcase, Plus, Trash2, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const ProfileServicesManager = ({ settings, setSettings, onClose }) => {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'services'
    const [editingService, setEditingService] = useState(null);
    const [newService, setNewService] = useState({
        nameEn: '', nameAr: '', price: '', descEn: '', descAr: ''
    });

    const handleSaveProfile = async () => {
        try {
            await updateDoc(doc(db, 'settings', 'clinic_settings'), {
                doctorProfile: settings.doctorProfile
            });
            alert(t('labels.save') + ' ✓');
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Error: ' + error.message);
        }
    };

    const handleAddService = () => {
        if (!newService.nameEn || !newService.nameAr || !newService.price) {
            alert('Please fill all required fields');
            return;
        }
        const service = {
            id: Date.now().toString(),
            ...newService
        };
        const updatedServices = [...settings.services, service];
        setSettings({ ...settings, services: updatedServices });
        setNewService({ nameEn: '', nameAr: '', price: '', descEn: '', descAr: '' });
        saveServices(updatedServices);
    };

    const handleUpdateService = (id) => {
        const updatedServices = settings.services.map(s =>
            s.id === id ? editingService : s
        );
        setSettings({ ...settings, services: updatedServices });
        setEditingService(null);
        saveServices(updatedServices);
    };

    const handleDeleteService = (id) => {
        if (!confirm(t('labels.cancel') + '?')) return;
        const updatedServices = settings.services.filter(s => s.id !== id);
        setSettings({ ...settings, services: updatedServices });
        saveServices(updatedServices);
    };

    const saveServices = async (services) => {
        try {
            await updateDoc(doc(db, 'settings', 'clinic_settings'), { services });
            alert(t('labels.save') + ' ✓');
        } catch (error) {
            console.error('Error saving services:', error);
            alert('Error: ' + error.message);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file');
                return;
            }

            // Validate file size (max 5MB before compression)
            if (file.size > 5 * 1024 * 1024) {
                alert('Image size should be less than 5MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Create canvas for compression
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Set max dimensions (maintain aspect ratio)
                    const maxWidth = 400;
                    const maxHeight = 400;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Draw and compress
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to base64 with higher compression (0.5 quality for JPEG = smaller size)
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);

                    // Update settings with compressed image
                    setSettings({
                        ...settings,
                        doctorProfile: { ...settings.doctorProfile, photoUrl: compressedBase64 }
                    });

                    console.log('Image compressed successfully. Size:', (compressedBase64.length / 1024).toFixed(2), 'KB');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <h2 className="text-2xl font-bold text-slate-900">
                        {t('dashboard.settings_btn')} - {activeTab === 'profile' ? 'Profile' : 'Services'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-4 px-6 font-semibold transition-all ${activeTab === 'profile' ? 'text-medical-600 border-b-2 border-medical-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <User className="w-5 h-5 inline mr-2" />
                        Doctor Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('services')}
                        className={`flex-1 py-4 px-6 font-semibold transition-all ${activeTab === 'services' ? 'text-medical-600 border-b-2 border-medical-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Briefcase className="w-5 h-5 inline mr-2" />
                        Services & Pricing
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'profile' ? (
                        <div className="space-y-6">
                            {/* Profile Image */}
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-medical-500">
                                    <img
                                        src={settings.doctorProfile.photoUrl || '/doctor-default.png'}
                                        alt="Doctor"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <label className="btn-secondary cursor-pointer">
                                    <Upload className="w-4 h-4 inline mr-2" />
                                    Upload Photo
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </label>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Doctor Name</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 outline-none"
                                    value={settings.doctorProfile.name}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        doctorProfile: { ...settings.doctorProfile, name: e.target.value }
                                    })}
                                />
                            </div>

                            {/* Specialty */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Specialty</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 outline-none"
                                    value={settings.doctorProfile.specialty}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        doctorProfile: { ...settings.doctorProfile, specialty: e.target.value }
                                    })}
                                />
                            </div>

                            {/* Bio */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Bio / About</label>
                                <textarea
                                    rows={4}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 outline-none resize-none"
                                    value={settings.doctorProfile.bio}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        doctorProfile: { ...settings.doctorProfile, bio: e.target.value }
                                    })}
                                />
                            </div>

                            <button onClick={handleSaveProfile} className="btn-primary w-full">
                                {t('labels.save')} Profile
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Add New Service */}
                            <div className="bg-medical-50 p-6 rounded-xl border-2 border-dashed border-medical-300">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <Plus className="w-5 h-5" />
                                    Add New Service
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Service Name (English)"
                                        className="px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-medical-500"
                                        value={newService.nameEn}
                                        onChange={(e) => setNewService({ ...newService, nameEn: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="اسم الخدمة (عربي)"
                                        className="px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-medical-500 text-right"
                                        value={newService.nameAr}
                                        onChange={(e) => setNewService({ ...newService, nameAr: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Price (e.g., $50)"
                                        className="px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-medical-500"
                                        value={newService.price}
                                        onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                                    />
                                    <div></div>
                                    <textarea
                                        placeholder="Description (English)"
                                        rows={2}
                                        className="px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-medical-500 resize-none"
                                        value={newService.descEn}
                                        onChange={(e) => setNewService({ ...newService, descEn: e.target.value })}
                                    />
                                    <textarea
                                        placeholder="الوصف (عربي)"
                                        rows={2}
                                        className="px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-medical-500 resize-none text-right"
                                        value={newService.descAr}
                                        onChange={(e) => setNewService({ ...newService, descAr: e.target.value })}
                                    />
                                </div>
                                <button onClick={handleAddService} className="btn-primary mt-4 w-full">
                                    <Plus className="w-4 h-4 inline mr-2" />
                                    Add Service
                                </button>
                            </div>

                            {/* Existing Services */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg">Existing Services</h3>
                                {settings.services.map((service) => (
                                    <div key={service.id} className="bg-white border border-slate-200 rounded-xl p-4">
                                        {editingService?.id === service.id ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                                        value={editingService.nameEn}
                                                        onChange={(e) => setEditingService({ ...editingService, nameEn: e.target.value })}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-right"
                                                        value={editingService.nameAr}
                                                        onChange={(e) => setEditingService({ ...editingService, nameAr: e.target.value })}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                                        value={editingService.price}
                                                        onChange={(e) => setEditingService({ ...editingService, price: e.target.value })}
                                                    />
                                                    <div></div>
                                                    <textarea
                                                        rows={2}
                                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                                                        value={editingService.descEn}
                                                        onChange={(e) => setEditingService({ ...editingService, descEn: e.target.value })}
                                                    />
                                                    <textarea
                                                        rows={2}
                                                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none text-right"
                                                        value={editingService.descAr}
                                                        onChange={(e) => setEditingService({ ...editingService, descAr: e.target.value })}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleUpdateService(service.id)} className="btn-primary flex-1">
                                                        {t('labels.save')}
                                                    </button>
                                                    <button onClick={() => setEditingService(null)} className="btn-secondary flex-1">
                                                        {t('labels.cancel')}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-lg">{service.nameEn} / {service.nameAr}</h4>
                                                    <p className="text-medical-600 font-semibold text-xl mt-1">{service.price}</p>
                                                    <p className="text-slate-600 text-sm mt-2">{service.descEn}</p>
                                                    <p className="text-slate-600 text-sm text-right mt-1">{service.descAr}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setEditingService(service)}
                                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteService(service.id)}
                                                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileServicesManager;
