import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { User, Role } from '../types';
import { Mail, Shield, Plus, Upload, X, Phone, Pencil, Key, Copy, Check, LogOut, Trash2 } from 'lucide-react';
import { cn } from '../utils';

interface TeamPageProps {
  user: User;
  isMobile?: boolean;
}

export function TeamPage({ user, isMobile }: TeamPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'seller', phone: '', sellerCode: '', password: '' });
  const [editMember, setEditMember] = useState<{ id: string; name: string; email: string; role: Role; phone: string; sellerCode: string; password?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [generatedTokens, setGeneratedTokens] = useState<Record<string, string>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expiryHours, setExpiryHours] = useState<number>(2);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    setLoading(true);
    api.getUsers().then(u => {
      setUsers(u);
    }).catch(err => {
      console.error(err);
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleGenerateToken = async (userId: string) => {
    try {
      const { token } = await api.generateLoginToken(userId, expiryHours);
      setGeneratedTokens(prev => ({ ...prev, [userId]: token }));
    } catch (err: any) {
      alert(err.message || 'Error al generar token');
    }
  };

  const handleForceLogout = async (userId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas cerrar todas las sesiones activas de este usuario?')) {
      return;
    }
    try {
      await api.forceLogout(userId);
      alert('Sesiones cerradas exitosamente.');
    } catch (err: any) {
      alert(err.message || 'Error al cerrar sesiones');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const generateRandomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createUser({ ...newMember, role: newMember.role as Role });
      setShowAddModal(false);
      setNewMember({ name: '', email: '', role: 'seller', phone: '', sellerCode: '', password: '' });
      loadUsers();
    } catch(err: any) {
      alert(err.message || 'Error al agregar miembro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setIsEditing(true);
    try {
      await api.updateUser(editMember.id, {
        name: editMember.name,
        email: editMember.email,
        role: editMember.role,
        phone: editMember.phone,
        sellerCode: editMember.sellerCode,
        password: editMember.password
      });
      setShowEditModal(false);
      setEditMember(null);
      loadUsers();
    } catch(err: any) {
      alert(err.message || 'Error al editar miembro');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteMember = async (targetUser: User) => {
    if (targetUser.id === user.id) {
      alert("No puedes eliminar tu propio usuario de sesión activa.");
      return;
    }
    const emailLower = (targetUser.email || '').toLowerCase();
    if (emailLower === 'seseffff942@gmail.com' || emailLower === 'limalopez22@gmail.com') {
      alert("Este usuario principal protegido no puede ser eliminado.");
      return;
    }
    if (!window.confirm(`¿Estás seguro de que deseas ELIMINAR permanentemente a "${targetUser.name}" del equipo? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await api.deleteUser(targetUser.id);
      setUsers(prev => prev.filter(u => u.id !== targetUser.id));
      if (showEditModal && editMember?.id === targetUser.id) {
        setShowEditModal(false);
        setEditMember(null);
      }
      alert(`Usuario "${targetUser.name}" eliminado exitosamente.`);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar usuario');
    }
  };

  const openEditModal = (u: User) => {
    setEditMember({ 
      id: u.id, 
      name: u.name, 
      email: u.email || '', 
      role: u.role, 
      phone: u.phone || '', 
      sellerCode: u.sellerCode || '',
      password: '' 
    });
    setShowEditModal(true);
  };

  const handlePhotoClick = (id: string) => {
    if (user.role !== 'admin') return;
    setSelectedUserId(id);
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUserId) return;
    try {
      await api.updateUserPhoto(selectedUserId, file);
      loadUsers();
    } catch(err) {
      alert("Error al actualizar la foto");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isHumanTeamMember = (u: User) => {
    if (!u || !u.name) return false;
    if ((u.role as string) === 'system') return false;
    const id = String(u.id || '').toLowerCase();
    const email = String(u.email || '').toLowerCase();
    const name = String(u.name || '').toLowerCase();
    if (id.startsWith('sys-') || id.startsWith('system-')) return false;
    if (email.startsWith('system-') || email.includes('agricovet.internal')) return false;
    if (name.includes('critical stock') || name.includes('logo config') || name.includes('whatsapp config') || name.includes('signature config') || name.includes('suppliers store') || name.includes('debts store') || name.includes('system') || name.includes('exclusion')) return false;
    return true;
  };

  const activeTeamMembers = users.filter(isHumanTeamMember);

  return (
    <div className={`max-w-5xl mx-auto ${isMobile ? 'p-4' : 'p-8'}`}>
      <div className="mb-8 flex flex-wrap gap-4 items-center justify-between">
        <div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tight">Equipo Agricovet</h1>
           <p className="text-slate-500 font-medium mt-1">Directorio de personal y accesos autorizados</p>
        </div>
        {user.role === 'admin' && (
          <button onClick={() => setShowAddModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={18} /> Agregar Miembro
          </button>
        )}
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />

      {loading ? (
        <div className="text-center py-20 text-neutral-400">Cargando equipo...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTeamMembers.map(u => (
            <div key={u.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-teal-50 to-emerald-50 border-b border-teal-100/50"></div>
              
              {user.role === 'admin' && (
                <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
                  <button 
                    onClick={() => openEditModal(u)} 
                    className="bg-white/70 backdrop-blur hover:bg-white text-slate-600 p-2 rounded-full shadow-xs transition-colors cursor-pointer"
                    title="Editar miembro"
                  >
                    <Pencil size={15} />
                  </button>
                  {u.id !== user.id && u.email !== 'seseffff942@gmail.com' && u.email !== 'limalopez22@gmail.com' && (
                    <button 
                      onClick={() => handleDeleteMember(u)} 
                      className="bg-white/70 backdrop-blur hover:bg-rose-50 text-slate-400 hover:text-rose-600 p-2 rounded-full shadow-xs transition-colors cursor-pointer"
                      title="Eliminar miembro del equipo"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}

              <div className="relative z-10 w-24 h-24 mb-4" onClick={() => handlePhotoClick(u.id)}>
                 {u.photo ? (
                    <img title={user.role === 'admin' ? "Click para cambiar foto" : ""} src={u.photo} alt={u.name} className={`w-full h-full rounded-2xl object-cover border-4 border-white shadow-sm ${user.role === 'admin' ? 'cursor-pointer group-hover:opacity-80 transition-opacity' : ''}`} />
                  ) : (
                    <div title={user.role === 'admin' ? "Click para cambiar foto" : ""} className={`w-full h-full rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 flex items-center justify-center text-3xl font-black border-4 border-white shadow-sm ${user.role === 'admin' ? 'cursor-pointer group-hover:opacity-80 transition-opacity' : ''}`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {user.role === 'admin' && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                       <div className="bg-black/50 p-2 rounded-full text-white"><Upload size={20} /></div>
                    </div>
                  )}
              </div>
              
              <h3 className="font-bold text-lg text-slate-800 relative z-10">{u.name}</h3>
              <div className="flex flex-col items-center gap-1.5 text-sm font-medium text-slate-500 mb-4 mt-1 relative z-10">
                {u.sellerCode && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-600 mb-1">
                    CÓDIGO: {u.sellerCode}
                  </div>
                )}
                {u.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={14} className="text-teal-500" />
                    <span>{u.email}</span>
                  </div>
                )}
                {(user.role === 'admin' || user.id === u.id) && u.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={14} className="text-teal-500" />
                    <span>{u.phone}</span>
                  </div>
                )}
              </div>
              
              <div className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg border shadow-sm mt-auto relative z-10",
                u.role === 'admin' ? "bg-teal-50 border-teal-100 text-teal-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"
              )}>
                {u.role === 'admin' && <Shield size={14} />}
                {u.role === 'admin' ? 'Administrador' : 'Vendedor'}
              </div>

              {user.role === 'admin' && (
                <div className="mt-4 w-full space-y-2 relative z-10">
                  {!generatedTokens[u.id] ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Validez:</label>
                        <select 
                          value={expiryHours}
                          onChange={(e) => setExpiryHours(parseInt(e.target.value))}
                          className="bg-slate-100 border-none rounded-lg text-[10px] font-bold text-slate-600 px-2 py-1 outline-none"
                        >
                          <option value={1}>1 hora</option>
                          <option value={2}>2 horas</option>
                          <option value={6}>6 horas</option>
                          <option value={12}>12 horas</option>
                          <option value={24}>24 horas</option>
                          <option value={48}>48 horas</option>
                        </select>
                      </div>
                      <button 
                        onClick={() => handleGenerateToken(u.id)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                      >
                        <Key size={12} />
                        Generar Token de Acceso
                      </button>
                      
                      <button 
                        onClick={() => handleForceLogout(u.id)}
                        className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-rose-100"
                      >
                        <LogOut size={12} />
                        Cerrar Sesiones Forzado
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl p-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 text-center font-mono font-black text-emerald-800 text-lg tracking-[0.25em] bg-white py-1 rounded-lg border border-emerald-100 shadow-inner">
                          {generatedTokens[u.id]}
                        </div>
                        <button 
                          onClick={() => copyToClipboard(generatedTokens[u.id])}
                          className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                          title="Copiar token"
                        >
                          {copiedToken === generatedTokens[u.id] ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-emerald-700 px-1 font-bold">
                        <span>Válido por {expiryHours}h</span>
                        <button 
                          type="button"
                          onClick={() => handleGenerateToken(u.id)}
                          className="underline hover:text-emerald-950 cursor-pointer"
                        >
                          Generar nuevo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {user?.email === 'seseffff942@gmail.com' && (
                <button 
                  onClick={async () => {
                    const confirm = window.confirm(`¿Quieres entrar a la cuenta de ${u.name}? No se cerrará su sesión activa.`);
                    if (confirm) {
                      try {
                        await api.impersonate(u.id);
                        window.location.href = '/';
                      } catch (err: any) {
                        alert(err.message || 'Error al suplantar');
                      }
                    }
                  }}
                  className={cn(
                    "mt-4 w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 cursor-pointer relative z-10",
                    u.role === 'admin' 
                      ? "border-teal-100 text-teal-600 hover:bg-teal-50 bg-white" 
                      : "border-emerald-100 text-emerald-600 hover:bg-emerald-50 bg-white"
                  )}
                >
                  Entrar como {u.role === 'admin' ? 'Admin' : 'Vendedor'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full p-1 transition-colors">
              <X size={20} />
            </button>
            <div className="p-8">
               <h2 className="text-2xl font-black text-slate-800 mb-1">Nuevo Miembro</h2>
               <p className="text-sm text-slate-500 mb-6 font-medium">Autoriza a un nuevo usuario para que pueda registrarse.</p>
               
               <form onSubmit={handleAddMember} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre</label>
                    <input type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" required placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
                    <input type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="correo@ejemplo.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                    <input type="text" value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Ej. 50212345678" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-bold text-slate-700">Código Vendedor</label>
                        <button type="button" onClick={() => setNewMember({...newMember, sellerCode: generateRandomCode()})} className="text-[10px] font-black text-teal-600 uppercase tracking-wider hover:underline">Generar</button>
                      </div>
                      <input type="text" value={newMember.sellerCode} onChange={e => setNewMember({...newMember, sellerCode: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none font-mono" placeholder="1234" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-bold text-slate-700">Contraseña</label>
                        <button type="button" onClick={() => setNewMember({...newMember, password: generateRandomPassword()})} className="text-[10px] font-black text-teal-600 uppercase tracking-wider hover:underline">Generar</button>
                      </div>
                      <input type="text" value={newMember.password} onChange={e => setNewMember({...newMember, password: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Clave" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Rol</label>
                    <select value={newMember.role} onChange={e => setNewMember({...newMember, role: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                      <option value="seller">Vendedor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition-colors">
                    {isSubmitting ? 'Guardando...' : 'Autorizar Usuario'}
                  </button>
               </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editMember && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowEditModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full p-1 transition-colors">
              <X size={20} />
            </button>
            <div className="p-8">
               <h2 className="text-2xl font-black text-slate-800 mb-1">Editar Miembro</h2>
               <p className="text-sm text-slate-500 mb-6 font-medium">Modifica los datos del usuario.</p>
               
               <form onSubmit={handleEditMember} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre</label>
                    <input type="text" value={editMember.name} onChange={e => setEditMember({...editMember, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" required placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
                    <input type="email" value={editMember.email} onChange={e => setEditMember({...editMember, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="correo@ejemplo.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                    <input type="text" value={editMember.phone} onChange={e => setEditMember({...editMember, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Ej. 50212345678" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-bold text-slate-700">Código Vendedor</label>
                        <button type="button" onClick={() => setEditMember({...editMember, sellerCode: generateRandomCode()})} className="text-[10px] font-black text-teal-600 uppercase tracking-wider hover:underline">Generar</button>
                      </div>
                      <input type="text" value={editMember.sellerCode} onChange={e => setEditMember({...editMember, sellerCode: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none font-mono" placeholder="1234" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-bold text-slate-700">Nueva Contraseña</label>
                        <button type="button" onClick={() => setEditMember({...editMember, password: generateRandomPassword()})} className="text-[10px] font-black text-teal-600 uppercase tracking-wider hover:underline">Generar</button>
                      </div>
                      <input type="text" value={editMember.password || ''} onChange={e => setEditMember({...editMember, password: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Opcional" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Rol</label>
                    <select value={editMember.role} onChange={e => setEditMember({...editMember, role: e.target.value as Role})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                      <option value="seller">Vendedor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isEditing} className="w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition-colors cursor-pointer">
                    {isEditing ? 'Guardando...' : 'Guardar Cambios'}
                  </button>

                  {editMember.id !== user.id && editMember.email !== 'seseffff942@gmail.com' && editMember.email !== 'limalopez22@gmail.com' && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = users.find(u => u.id === editMember.id);
                        if (target) handleDeleteMember(target);
                      }}
                      className="w-full mt-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
                    >
                      <Trash2 size={15} />
                      Eliminar Usuario del Equipo
                    </button>
                  )}
               </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

