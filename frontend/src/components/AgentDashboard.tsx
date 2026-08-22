import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, MapPin, Navigation, Radio, Power, ClipboardList } from 'lucide-react';

interface AgentDashboardProps {
  token: string;
  user: any;
  onLogout: () => void;
}

export default function AgentDashboard({ token, user, onLogout }: AgentDashboardProps) {
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Simulation state
  const [simLat, setSimLat] = useState(12.9716);
  const [simLng, setSimLng] = useState(77.5946);
  const [simulating, setSimulating] = useState(false);

  // Status notes state
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});

  const fetchProfileAndOrders = async () => {
    try {
      const profileRes = await axios.get('http://localhost:5000/api/agents/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(profileRes.data);
      setSimLat(profileRes.data.currentLat);
      setSimLng(profileRes.data.currentLng);

      const ordersRes = await axios.get('http://localhost:5000/api/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(ordersRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch agent profile/orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndOrders();
  }, [token]);

  const handleToggleStatus = async () => {
    if (!profile) return;
    const nextStatus = profile.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    try {
      const res = await axios.post(
        'http://localhost:5000/api/agents/status',
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(res.data);
      fetchProfileAndOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const res = await axios.post(
        'http://localhost:5000/api/agents/location',
        { lat: Number(simLat), lng: Number(simLng) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(res.data);
      alert('Location updated successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update location.');
    } finally {
      setSimulating(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    const notes = statusNotes[orderId] || '';
    if (newStatus === 'FAILED' && !notes.trim()) {
      alert('A reason note is required when marking a delivery attempt as FAILED.');
      return;
    }

    try {
      await axios.post(
        `http://localhost:5000/api/orders/${orderId}/status`,
        { status: newStatus, notes: notes || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Clean notes field
      setStatusNotes((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      fetchProfileAndOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update order status.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lm-amber"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-lm-steel border border-lm-line rounded-xl text-center">
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Agent Dashboard</h2>
        <p className="text-lm-fog-dim mb-4">{error || 'Agent profile not found'}</p>
        <button onClick={onLogout} className="text-lm-amber font-semibold hover:underline">
          Log Out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lm-ink p-6 text-[#C7CDD6]">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-lm-line pb-6">
        <div>
          <div className="text-2xl font-bold text-white lm-display">
            LASTMILE<span className="text-lm-amber">.</span>
          </div>
          <div className="text-xs text-lm-fog-dim mt-1">Logged in as {user.email} (Agent)</div>
        </div>
        <button
          onClick={onLogout}
          className="text-sm font-medium border border-lm-line text-lm-fog-dim px-4 py-2 rounded-lg hover:text-white"
        >
          Sign Out
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agent Profile & Simulation Column */}
        <div className="space-y-6">
          {/* Profile Details */}
          <div className="bg-lm-steel border border-lm-line rounded-xl p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-lm-amber" /> Agent Profile
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-lm-fog-dim">ID:</span>
                <span className="text-white lm-mono font-medium">{profile.id.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-lm-fog-dim">Status:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                    profile.status === 'AVAILABLE'
                      ? 'bg-lm-teal/20 text-lm-teal border border-lm-teal/30'
                      : profile.status === 'BUSY'
                      ? 'bg-lm-amber/20 text-lm-amber border border-lm-amber/30'
                      : 'bg-lm-line text-lm-fog-dim border border-lm-line'
                  }`}
                >
                  {profile.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-lm-fog-dim">Active Capacity:</span>
                <span className="text-white font-medium">
                  {profile.activeCount} / {profile.maxConcurrent} Orders
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-lm-fog-dim">Zones Cover:</span>
                <span className="text-white font-medium max-w-[150px] truncate" title={profile.zoneCoverage}>
                  {profile.zoneCoverage || 'No zones coverage'}
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleStatus}
              className={`w-full font-bold py-2 px-4 rounded-lg mt-5 text-xs flex items-center justify-center gap-1.5 transition-all ${
                profile.status === 'OFFLINE'
                  ? 'bg-lm-teal text-lm-ink hover:bg-opacity-95'
                  : 'bg-lm-red/20 text-red-300 border border-lm-red/40 hover:bg-lm-red/30'
              }`}
            >
              <Power size={14} /> {profile.status === 'OFFLINE' ? 'Go Online (AVAILABLE)' : 'Go Offline'}
            </button>
          </div>

          {/* Location Simulator */}
          <div className="bg-lm-steel border border-lm-line rounded-xl p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Radio size={18} className="text-lm-amber animate-pulse" /> Live Location Simulator
            </h3>
            <p className="text-[11px] text-lm-fog-dim mb-4">
              Update your current coordinates to test auto-dispatch agent-to-pickup routing.
            </p>

            <form onSubmit={handleUpdateLocation} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-lm-fog-dim mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                    value={simLat}
                    onChange={(e) => setSimLat(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-lm-fog-dim mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                    value={simLng}
                    onChange={(e) => setSimLng(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    // Set to seeded Zone 2 (Indiranagar) coords
                    setSimLat(12.9784);
                    setSimLng(77.6408);
                  }}
                  className="bg-lm-steel-2 border border-lm-line text-lm-fog-dim font-bold py-1.5 rounded hover:text-white"
                >
                  Zone 2 Coords
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Set to seeded Zone 1 (Central Bangalore) coords
                    setSimLat(12.9716);
                    setSimLng(77.5946);
                  }}
                  className="bg-lm-steel-2 border border-lm-line text-lm-fog-dim font-bold py-1.5 rounded hover:text-white"
                >
                  Zone 1 Coords
                </button>
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full bg-lm-amber text-lm-ink font-bold py-2 px-4 rounded-lg text-xs hover:bg-opacity-95"
              >
                {simulating ? 'Simulating...' : 'Transmit Location Ping'}
              </button>
            </form>
          </div>
        </div>

        {/* Assigned Orders List Column */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 lm-display">
            <Truck size={20} className="text-lm-amber" /> Active Assigned Orders ({orders.length})
          </h3>

          {orders.length === 0 ? (
            <div className="text-center py-20 bg-lm-steel rounded-xl border border-lm-line">
              <ClipboardList size={40} className="mx-auto text-lm-fog-dim mb-3" />
              <h4 className="font-semibold text-white">No Shipments Assigned</h4>
              <p className="text-xs text-lm-fog-dim mt-1">
                You will receive assignments in real-time when clients create orders mapping to your coverage.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const nextStatuses: Record<string, string[]> = {
                  ASSIGNED: ['PICKED_UP'],
                  PICKED_UP: ['IN_TRANSIT'],
                  IN_TRANSIT: ['OUT_FOR_DELIVERY'],
                  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED']
                };
                const availableTransitions = nextStatuses[order.currentStatus] || [];

                return (
                  <div
                    key={order.id}
                    className="bg-lm-steel border border-lm-line rounded-xl p-5 space-y-4"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-lm-fog-dim">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 border border-lm-amber bg-lm-amber/10 text-lm-amber rounded uppercase">
                        {order.currentStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-lm-fog-dim bg-lm-steel-2 p-3 rounded border border-lm-line">
                      <div className="flex gap-2">
                        <MapPin size={16} className="text-lm-amber shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[9px] font-semibold text-lm-fog-dim">PICKUP</div>
                          <div className="text-white font-medium">{order.pickupAddress}</div>
                          <div className="text-[10px] mt-0.5">Pincode: {order.pickupPincode}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Navigation size={16} className="text-lm-teal shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[9px] font-semibold text-lm-fog-dim">DELIVERY DROP</div>
                          <div className="text-white font-medium">{order.dropAddress}</div>
                          <div className="text-[10px] mt-0.5">Pincode: {order.dropPincode}</div>
                        </div>
                      </div>
                    </div>

                    {/* Transition Controls */}
                    {availableTransitions.length > 0 ? (
                      <div className="pt-2">
                        <div className="text-xs font-semibold text-white mb-2">Transition Order State</div>

                        {availableTransitions.includes('FAILED') && (
                          <div className="mb-3">
                            <label className="block text-[10px] text-lm-fog-dim mb-1">
                              Reason Note (Required only for Failures)
                            </label>
                            <input
                              type="text"
                              className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-1.5 text-xs text-white placeholder-lm-fog-dim focus:outline-none"
                              placeholder="Customer unavailable / Gate locked / Weather issues..."
                              value={statusNotes[order.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStatusNotes((prev) => ({ ...prev, [order.id]: val }));
                              }}
                            />
                          </div>
                        )}

                        <div className="flex gap-2">
                          {availableTransitions.map((nextStatus) => (
                            <button
                              key={nextStatus}
                              onClick={() => handleUpdateOrderStatus(order.id, nextStatus)}
                              className={`flex-1 py-2 rounded text-xs font-bold transition-all ${
                                nextStatus === 'FAILED'
                                  ? 'bg-lm-red/20 text-red-300 border border-lm-red/40 hover:bg-lm-red/30'
                                  : nextStatus === 'DELIVERED'
                                  ? 'bg-lm-teal text-lm-ink hover:bg-opacity-90'
                                  : 'bg-lm-amber text-lm-ink hover:bg-opacity-90'
                              }`}
                            >
                              Mark as {nextStatus.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-center py-2 bg-lm-steel-2 rounded text-lm-fog-dim border border-lm-line italic">
                        Order in terminal state: {order.currentStatus}. No more transitions available.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
