import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Map, CreditCard, ShoppingBag, Eye, RefreshCw, Users } from 'lucide-react';

interface AdminDashboardProps {
  token: string;
  user: any;
  onLogout: () => void;
}

export default function AdminDashboard({ token, user, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'zones' | 'rates' | 'agents'>('orders');

  // Core Data State
  const [orders, setOrders] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [codConfigs, setCodConfigs] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');

  // Zone creation form
  const [newZoneName, setNewZoneName] = useState('');
  // Mapping form
  const [mapPincode, setMapPincode] = useState('');
  const [mapAreaName, setMapAreaName] = useState('');
  const [mapZoneId, setMapZoneId] = useState('');

  // Rate card form
  const [rateOrderType, setRateOrderType] = useState<'B2B' | 'B2C'>('B2C');
  const [rateZoneRelation, setRateZoneRelation] = useState<'INTRA' | 'INTER'>('INTRA');
  const [rateBase, setRateBase] = useState(50);
  const [ratePerKg, setRatePerKg] = useState(10);
  const [rateFrom, setRateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [rateTo, setRateTo] = useState(new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]);

  // COD config form
  const [codOrderType, setCodOrderType] = useState<'B2B' | 'B2C'>('B2C');
  const [codSurcharge, setCodSurcharge] = useState(25);

  // Manual assign form
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // Override status form
  const [overridingOrderId, setOverridingOrderId] = useState<string | null>(null);
  const [overrideStatusVal, setOverrideStatusVal] = useState('ASSIGNED');
  const [overrideNotes, setOverrideNotes] = useState('');

  // Tracking details modal
  const [inspectingOrder, setInspectingOrder] = useState<any | null>(null);

  // Agent registration form
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('123456');
  const [newAgentCapacity, setNewAgentCapacity] = useState(3);
  const [selectedCoverageZones, setSelectedCoverageZones] = useState<string[]>([]);
  const [agentRegError, setAgentRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ordRes, zoneRes, rateRes, codRes, agentRes] = await Promise.all([
        axios.get('http://localhost:5000/api/orders', { headers }),
        axios.get('http://localhost:5000/api/zones', { headers }),
        axios.get('http://localhost:5000/api/rates/cards', { headers }),
        axios.get('http://localhost:5000/api/rates/cod', { headers }),
        axios.get('http://localhost:5000/api/agents', { headers })
      ]);

      setOrders(ordRes.data);
      setZones(zoneRes.data);
      setRates(rateRes.data);
      setCodConfigs(codRes.data);
      setAgents(agentRes.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Handle Agent registration
  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setAgentRegError('');
    try {
      await axios.post(
        'http://localhost:5000/api/agents',
        {
          email: newAgentEmail,
          password: newAgentPassword,
          maxConcurrent: newAgentCapacity,
          zoneCoverage: selectedCoverageZones.join(',')
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Reset form
      setNewAgentEmail('');
      setNewAgentPassword('123456');
      setNewAgentCapacity(3);
      setSelectedCoverageZones([]);
      // Reload agents list
      fetchData();
      alert('Agent registered successfully!');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error;
      if (Array.isArray(errorMsg)) {
        const message = errorMsg.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        setAgentRegError(message);
      } else if (typeof errorMsg === 'string') {
        setAgentRegError(errorMsg);
      } else {
        setAgentRegError('Failed to register agent.');
      }
    } finally {
      setRegLoading(false);
    }
  };

  // Handle Zone creation
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        'http://localhost:5000/api/zones',
        { name: newZoneName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewZoneName('');
      fetchData();
      alert('Zone created successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create zone.');
    }
  };

  // Handle area-zone mapping
  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        'http://localhost:5000/api/zones/mapping',
        { pincode: mapPincode, areaName: mapAreaName, zoneId: mapZoneId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMapPincode('');
      setMapAreaName('');
      fetchData();
      alert('Area mapped successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to map area.');
    }
  };

  // Handle rate card creation
  const handleCreateRateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        'http://localhost:5000/api/rates/cards',
        {
          orderType: rateOrderType,
          zoneRelation: rateZoneRelation,
          baseRate: Number(rateBase),
          perKgRate: Number(ratePerKg),
          effectiveFrom: new Date(rateFrom).toISOString(),
          effectiveTo: new Date(rateTo).toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
      alert('Rate card created successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create rate card.');
    }
  };

  // Handle COD surcharge config
  const handleSetCODConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        'http://localhost:5000/api/rates/cod',
        { orderType: codOrderType, surchargeAmount: Number(codSurcharge) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
      alert('COD surcharge configured successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set COD config.');
    }
  };

  // Trigger auto-assignment or manual agent assignment
  const handleAssignAgent = async (orderId: string, manual: boolean) => {
    try {
      const payload = manual ? { agentId: selectedAgentId } : {};
      await axios.post(
        `http://localhost:5000/api/orders/${orderId}/assign`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssigningOrderId(null);
      setSelectedAgentId('');
      fetchData();
      alert(manual ? 'Agent assigned manually!' : 'Auto-assignment successfully dispatched!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Assignment failed.');
    }
  };

  // Override order status (Admin super privilege)
  const handleOverrideStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overridingOrderId) return;

    try {
      await axios.post(
        `http://localhost:5000/api/orders/${overridingOrderId}/status`,
        { status: overrideStatusVal, notes: overrideNotes || 'Admin override.' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOverridingOrderId(null);
      setOverrideNotes('');
      fetchData();
      alert('Order status overridden successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Override failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lm-amber"></div>
      </div>
    );
  }

  // Filter orders by status
  const filteredOrders = statusFilter
    ? orders.filter((o) => o.currentStatus === statusFilter)
    : orders;

  return (
    <div className="min-h-screen bg-lm-ink p-6 text-[#C7CDD6]">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-lm-line pb-6">
        <div>
          <div className="text-2xl font-bold text-white lm-display">
            LASTMILE<span className="text-lm-amber">.</span>
          </div>
          <div className="text-xs text-lm-fog-dim mt-1">Logged in as {user.email} (Administrator)</div>
        </div>
        <button
          onClick={onLogout}
          className="text-sm font-medium border border-lm-line text-lm-fog-dim px-4 py-2 rounded-lg hover:text-white"
        >
          Sign Out
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto flex gap-4 border-b border-lm-line mb-8">
        <button
          className={`py-3 px-2 font-bold text-sm flex items-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'orders'
              ? 'border-lm-amber text-white'
              : 'border-transparent text-lm-fog-dim hover:text-white'
          }`}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingBag size={16} /> Manage Shipments
        </button>
        <button
          className={`py-3 px-2 font-bold text-sm flex items-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'zones'
              ? 'border-lm-amber text-white'
              : 'border-transparent text-lm-fog-dim hover:text-white'
          }`}
          onClick={() => setActiveTab('zones')}
        >
          <Map size={16} /> Zone Boundaries
        </button>
        <button
          className={`py-3 px-2 font-bold text-sm flex items-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'rates'
              ? 'border-lm-amber text-white'
              : 'border-transparent text-lm-fog-dim hover:text-white'
          }`}
          onClick={() => setActiveTab('rates')}
        >
          <CreditCard size={16} /> Rates & COD Config
        </button>
        <button
          className={`py-3 px-2 font-bold text-sm flex items-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'agents'
              ? 'border-lm-amber text-white'
              : 'border-transparent text-lm-fog-dim hover:text-white'
          }`}
          onClick={() => setActiveTab('agents')}
        >
          <Users size={16} /> Delivery Agents
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="max-w-6xl mx-auto">
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Orders Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-lm-steel p-4 rounded-xl border border-lm-line">
              <span className="font-bold text-white text-sm">Filter Shipments</span>
              <div className="flex gap-4 w-full md:w-auto">
                <select
                  className="bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-xs text-white placeholder-lm-fog-dim w-full md:w-48 focus:outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PLACED">Placed</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="PICKED_UP">Picked Up</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="FAILED">Failed</option>
                </select>
                <button
                  onClick={fetchData}
                  className="bg-lm-steel-2 border border-lm-line text-lm-fog-dim hover:text-white px-3 py-2 rounded text-xs"
                >
                  Refresh Data
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-lm-steel border border-lm-line rounded-xl overflow-x-auto">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="border-b border-lm-line text-lm-fog-dim">
                    <th className="p-4 font-semibold">Order ID</th>
                    <th className="p-4 font-semibold">Customer</th>
                    <th className="p-4 font-semibold">Pickup/Drop</th>
                    <th className="p-4 font-semibold">Type/Payment</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Billed Cost</th>
                    <th className="p-4 font-semibold">Assigned Agent</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lm-line">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-lm-fog-dim italic">
                        No orders match the filter constraints.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      let breakdown: any = {};
                      try {
                        breakdown = typeof order.chargeBreakdown === 'string'
                          ? JSON.parse(order.chargeBreakdown)
                          : (order.chargeBreakdown || {});
                      } catch (e) {
                        console.error('Failed to parse charge breakdown:', e);
                      }
                      return (
                        <tr key={order.id} className="hover:bg-lm-steel-2">
                          <td className="p-4 font-mono font-semibold text-white">
                            #{order.id.substring(0, 8).toUpperCase()}
                          </td>
                          <td className="p-4">
                            {order.customer?.email ? order.customer.email.split('@')[0] : 'Customer'}
                          </td>
                          <td className="p-4">
                            <div>From: {order.pickupPincode}</div>
                            <div className="text-lm-fog-dim">To: {order.dropPincode}</div>
                          </td>
                          <td className="p-4">
                            <div>{order.orderType}</div>
                            <div className="text-lm-fog-dim">{order.paymentType}</div>
                          </td>
                          <td className="p-4">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 border rounded uppercase ${
                                order.currentStatus === 'DELIVERED'
                                  ? 'border-lm-teal text-lm-teal bg-lm-teal/10'
                                  : order.currentStatus === 'FAILED'
                                  ? 'border-lm-red text-lm-red bg-lm-red/10'
                                  : 'border-lm-amber text-lm-amber bg-lm-amber/10'
                              }`}
                            >
                              {order.currentStatus}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-white">₹{breakdown.totalCharge}</td>
                           <td className="p-4">
                            {order.agent ? (
                              <div className="font-semibold text-white">
                                {order.agent?.user?.email ? order.agent.user.email.split('@')[0] : 'Assigned'}
                              </div>
                            ) : (
                              <span className="text-[10px] text-lm-amber font-medium">Unassigned</span>
                            )}
                          </td>
                          <td className="p-4 text-right space-y-1.5">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setInspectingOrder(order)}
                                className="bg-lm-steel-2 border border-lm-line text-white py-1 px-2.5 rounded text-[10px] flex items-center gap-1"
                              >
                                <Eye size={10} /> Inspect
                              </button>

                              {order.currentStatus !== 'DELIVERED' && order.currentStatus !== 'FAILED' && (
                                <button
                                  onClick={() => setAssigningOrderId(order.id)}
                                  className="bg-lm-amber text-lm-ink py-1 px-2.5 rounded font-bold text-[10px]"
                                >
                                  {order.agentId ? 'Reassign' : 'Assign Agent'}
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setOverridingOrderId(order.id);
                                  setOverrideStatusVal(order.currentStatus);
                                }}
                                className="bg-lm-red/20 text-red-300 border border-lm-red/40 py-1 px-2.5 rounded text-[10px]"
                              >
                                Override Status
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Create Zones Form */}
            <div className="bg-lm-steel border border-lm-line rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm mb-2">Create New Delivery Zone</h3>
              <form onSubmit={handleCreateZone} className="space-y-4 text-xs">
                <div>
                  <label className="block text-lm-fog-dim mb-1">Zone Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white placeholder-lm-fog-dim focus:outline-none"
                    placeholder="Zone 4 - Kora / Outer"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-lm-amber text-lm-ink font-bold py-2 px-4 rounded hover:bg-opacity-95"
                >
                  Create Zone
                </button>
              </form>
            </div>

            {/* Map Area Pincode Form */}
            <div className="bg-lm-steel border border-lm-line rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm mb-2">Map Pincode to Delivery Zone</h3>
              <form onSubmit={handleCreateMapping} className="space-y-4 text-xs">
                <div>
                  <label className="block text-lm-fog-dim mb-1">Pincode</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                    placeholder="560048"
                    value={mapPincode}
                    onChange={(e) => setMapPincode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-lm-fog-dim mb-1">Area Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                    placeholder="Mahadevapura / Outer Ring Road"
                    value={mapAreaName}
                    onChange={(e) => setMapAreaName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-lm-fog-dim mb-1">Target Zone</label>
                  <select
                    required
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                    value={mapZoneId}
                    onChange={(e) => setMapZoneId(e.target.value)}
                  >
                    <option value="">Select a Zone</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!mapZoneId}
                  className="w-full bg-lm-amber text-lm-ink font-bold py-2 px-4 rounded hover:bg-opacity-95"
                >
                  Assign Mapping
                </button>
              </form>
            </div>

            {/* Zones Boundaries Listing */}
            <div className="bg-lm-steel border border-lm-line rounded-xl p-5 md:col-span-2 space-y-4">
              <h3 className="font-bold text-white text-sm">Zone Mapping Database</h3>
              <div className="space-y-4">
                {zones.map((z) => (
                  <div key={z.id} className="bg-lm-steel-2 border border-lm-line rounded-lg p-4">
                    <span className="font-semibold text-white text-xs">{z.name}</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                      {z.mappings?.length === 0 ? (
                        <span className="text-[10px] text-lm-fog-dim italic col-span-full">
                          No area pincodes mapped to this zone yet.
                        </span>
                      ) : (
                        z.mappings.map((m: any) => (
                          <div
                            key={m.id}
                            className="bg-lm-steel border border-lm-line p-2 rounded text-[10px]"
                          >
                            <div className="font-semibold text-white">{m.pincode}</div>
                            <div className="text-lm-fog-dim truncate">{m.areaName}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Create Rate Card */}
            <div className="bg-lm-steel border border-lm-line rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm mb-2">Create Rate Card Version</h3>
              <form onSubmit={handleCreateRateCard} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-lm-fog-dim mb-1">Order Type</label>
                    <select
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                      value={rateOrderType}
                      onChange={(e: any) => setRateOrderType(e.target.value)}
                    >
                      <option value="B2C">B2C</option>
                      <option value="B2B">B2B</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-lm-fog-dim mb-1">Zone Relation</label>
                    <select
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                      value={rateZoneRelation}
                      onChange={(e: any) => setRateZoneRelation(e.target.value)}
                    >
                      <option value="INTRA">INTRA</option>
                      <option value="INTER">INTER</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-lm-fog-dim mb-1">Base Charge (₹)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                      value={rateBase}
                      onChange={(e) => setRateBase(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-lm-fog-dim mb-1">Per Kg Rate (₹)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                      value={ratePerKg}
                      onChange={(e) => setRatePerKg(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-lm-fog-dim mb-1">Effective From</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                      value={rateFrom}
                      onChange={(e) => setRateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-lm-fog-dim mb-1">Effective To</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                      value={rateTo}
                      onChange={(e) => setRateTo(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-lm-amber text-lm-ink font-bold py-2 px-4 rounded hover:bg-opacity-95"
                >
                  Create Rate Card
                </button>
              </form>
            </div>

            {/* Set COD Surcharge */}
            <div className="bg-lm-steel border border-lm-line rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm mb-2">Configure COD Surcharges</h3>
              <form onSubmit={handleSetCODConfig} className="space-y-4 text-xs">
                <div>
                  <label className="block text-lm-fog-dim mb-1">Order Type</label>
                  <select
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                    value={codOrderType}
                    onChange={(e: any) => setCodOrderType(e.target.value)}
                  >
                    <option value="B2C">B2C</option>
                    <option value="B2B">B2B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-lm-fog-dim mb-1">Surcharge Amount (₹)</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white"
                    value={codSurcharge}
                    onChange={(e) => setCodSurcharge(Number(e.target.value))}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-lm-amber text-lm-ink font-bold py-2 px-4 rounded hover:bg-opacity-95"
                >
                  Save Surcharge Configuration
                </button>
              </form>

              {/* Show current COD Configs */}
              <div className="pt-2 border-t border-lm-line mt-4">
                <span className="text-[10px] font-bold text-lm-fog-dim uppercase">Current COD Configs</span>
                <div className="flex gap-4 mt-2 text-xs">
                  {codConfigs.map((c) => (
                    <div key={c.id} className="bg-lm-steel-2 border border-lm-line rounded p-2 flex-1">
                      <span className="font-semibold text-white">{c.orderType}</span>
                      <div className="text-lm-amber font-mono font-medium">₹{c.surchargeAmount}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* List Rate Cards */}
            <div className="bg-lm-steel border border-lm-line rounded-xl p-5 md:col-span-2 space-y-4">
              <h3 className="font-bold text-white text-sm">Active Pricing Rate Cards</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="border-b border-lm-line text-lm-fog-dim">
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Relation</th>
                      <th className="pb-3">Base Charge</th>
                      <th className="pb-3">Per Kg Rate</th>
                      <th className="pb-3">Effective Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lm-line text-lm-fog">
                    {rates.map((card) => (
                      <tr key={card.id}>
                        <td className="py-2.5 font-semibold text-white">{card.orderType}</td>
                        <td className="py-2.5">{card.zoneRelation}</td>
                        <td className="py-2.5 font-mono">₹{card.baseRate}</td>
                        <td className="py-2.5 font-mono">₹{card.perKgRate}/kg</td>
                        <td className="py-2.5 text-lm-fog-dim text-[11px]">
                          {new Date(card.effectiveFrom).toLocaleDateString()} to{' '}
                          {new Date(card.effectiveTo).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* List Table (2/3 width on large screens) */}
            <div className="bg-lm-steel border border-lm-line rounded-xl p-5 lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-white text-sm">Registered Delivery Agents</h3>
                <button
                  onClick={fetchData}
                  className="bg-lm-steel-2 border border-lm-line text-lm-fog-dim hover:text-white px-3 py-1.5 rounded text-xs"
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="border-b border-lm-line text-lm-fog-dim">
                      <th className="pb-3">Agent ID</th>
                      <th className="pb-3">Email Address</th>
                      <th className="pb-3">Current Status</th>
                      <th className="pb-3">Active Capacity</th>
                      <th className="pb-3">Zone Coverage</th>
                      <th className="pb-3">Credentials (Password)</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lm-line text-lm-fog">
                    {agents.map((agent) => (
                      <tr key={agent.id} className="hover:bg-lm-steel-2">
                        <td className="py-3 font-mono font-medium text-white">
                          {agent.id.substring(0, 8)}...
                        </td>
                        <td className="py-3 font-semibold text-white">{agent.user?.email}</td>
                        <td className="py-3">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 border rounded uppercase ${
                              agent.status === 'AVAILABLE'
                                ? 'border-lm-teal text-lm-teal bg-lm-teal/10'
                                : agent.status === 'BUSY'
                                ? 'border-lm-amber text-lm-amber bg-lm-amber/10'
                                : 'border-lm-line text-lm-fog-dim bg-lm-steel'
                            }`}
                          >
                            {agent.status}
                          </span>
                        </td>
                        <td className="py-3 font-medium">
                          {agent.activeCount} / {agent.maxConcurrent} Active
                        </td>
                        <td className="py-3 text-lm-fog-dim truncate max-w-[120px]" title={agent.zoneCoverage}>
                          {agent.zoneCoverage || 'No coverage'}
                        </td>
                        <td className="py-3">
                          <span className="bg-lm-steel-2 border border-lm-line px-2 py-0.5 rounded text-[10px] lm-mono text-lm-amber font-semibold">
                            Password: 123456
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={async () => {
                              if (window.confirm(`Reset password for agent ${agent.user?.email} to "123456"?`)) {
                                try {
                                  await axios.post(
                                    `http://localhost:5000/api/agents/${agent.id}/reset-password`,
                                    {},
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  alert('Agent password reset successfully to: 123456');
                                } catch (err: any) {
                                  alert(err.response?.data?.error || 'Password reset failed.');
                                }
                              }
                            }}
                            className="bg-lm-red/20 text-red-300 border border-lm-red/40 py-1 px-2.5 rounded text-[10px] hover:bg-lm-red/30"
                          >
                            Reset Pass
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Register New Agent Form (1/3 width) */}
            <div className="bg-lm-steel border border-lm-line rounded-xl p-5 space-y-4 h-fit">
              <h3 className="font-bold text-white text-sm">Register New Delivery Agent</h3>
              <form onSubmit={handleRegisterAgent} className="space-y-4 text-xs">
                {/* Email */}
                <div>
                  <label className="block text-lm-fog-dim mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="agent.name@lastmile.com"
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white focus:outline-none focus:border-lm-amber"
                    value={newAgentEmail}
                    onChange={(e) => setNewAgentEmail(e.target.value)}
                  />
                </div>
                {/* Password */}
                <div>
                  <label className="block text-lm-fog-dim mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white focus:outline-none focus:border-lm-amber"
                    value={newAgentPassword}
                    onChange={(e) => setNewAgentPassword(e.target.value)}
                  />
                </div>
                {/* Max Concurrent Orders */}
                <div>
                  <label className="block text-lm-fog-dim mb-1">Max Concurrent Capacity</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white focus:outline-none focus:border-lm-amber"
                    value={newAgentCapacity}
                    onChange={(e) => setNewAgentCapacity(Number(e.target.value))}
                  />
                </div>
                {/* Zone Coverage selection */}
                <div>
                  <label className="block text-lm-fog-dim mb-1">Zone Coverage (Select multiple)</label>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto border border-lm-line rounded p-2.5 bg-lm-steel-2">
                    {zones.length === 0 ? (
                      <div className="text-lm-fog-dim italic text-[11px]">No zones created yet.</div>
                    ) : (
                      zones.map((zone) => (
                        <label key={zone.id} className="flex items-center gap-2 cursor-pointer text-white">
                          <input
                            type="checkbox"
                            value={zone.id}
                            checked={selectedCoverageZones.includes(zone.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCoverageZones([...selectedCoverageZones, zone.id]);
                              } else {
                                setSelectedCoverageZones(selectedCoverageZones.filter((id) => id !== zone.id));
                              }
                            }}
                            className="accent-lm-amber"
                          />
                          {zone.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {agentRegError && (
                  <div className="text-lm-red font-medium text-[11px]">{agentRegError}</div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full bg-lm-amber text-lm-ink font-bold py-2 rounded hover:bg-opacity-95 disabled:opacity-50"
                >
                  {regLoading ? 'Registering...' : 'Register Agent Profile'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Assign Agent Modal */}
      {assigningOrderId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-lm-steel border border-lm-line rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 lm-display">Dispatch shipment</h3>

            <div className="space-y-4 text-xs">
              <button
                onClick={() => handleAssignAgent(assigningOrderId, false)}
                className="w-full bg-lm-amber text-lm-ink font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 hover:bg-opacity-95"
              >
                <RefreshCw size={14} /> Dispatch via Auto-Assignment
              </button>

              <div className="border-t border-lm-line my-4 pt-4">
                <label className="block text-lm-fog-dim mb-2 font-semibold">Or Select Available Agent Manually</label>
                <select
                  className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white focus:outline-none mb-3"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">Select an Agent</option>
                  {agents
                    .filter((a) => a.status !== 'OFFLINE' && a.activeCount < a.maxConcurrent)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.user.email.split('@')[0]} (Status: {a.status}, Capacity: {a.activeCount}/{a.maxConcurrent})
                      </option>
                    ))}
                </select>

                <button
                  onClick={() => handleAssignAgent(assigningOrderId, true)}
                  disabled={!selectedAgentId}
                  className="w-full bg-lm-steel-2 border border-lm-line text-white font-bold py-2.5 rounded-lg hover:text-lm-amber hover:border-lm-amber disabled:opacity-50"
                >
                  Assign Agent Manually
                </button>
              </div>

              <button
                onClick={() => setAssigningOrderId(null)}
                className="w-full bg-transparent text-lm-fog-dim py-2 text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Status Modal */}
      {overridingOrderId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-lm-steel border border-lm-line rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 lm-display">Override Shipment Status</h3>
            <form onSubmit={handleOverrideStatus} className="space-y-4 text-xs">
              <div>
                <label className="block text-lm-fog-dim mb-1">New Status</label>
                <select
                  className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white focus:outline-none"
                  value={overrideStatusVal}
                  onChange={(e) => setOverrideStatusVal(e.target.value)}
                >
                  <option value="PLACED">PLACED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="PICKED_UP">PICKED_UP</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              <div>
                <label className="block text-lm-fog-dim mb-1">Override Reason Notes</label>
                <input
                  type="text"
                  required
                  className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white focus:outline-none"
                  placeholder="Address issues solved / Delivery marked by phone..."
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-lm-amber text-lm-ink font-bold py-2.5 rounded-lg hover:bg-opacity-95"
              >
                Apply Override
              </button>

              <button
                type="button"
                onClick={() => setOverridingOrderId(null)}
                className="w-full bg-transparent text-lm-fog-dim py-2 text-center"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Timeline Modal */}
      {inspectingOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-lm-steel border border-lm-line rounded-2xl p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white lm-display">Inspect Audit Timeline</h3>
              <button
                onClick={() => setInspectingOrder(null)}
                className="text-lm-fog-dim hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs space-y-1.5 text-lm-fog-dim border border-lm-line rounded p-3 bg-lm-steel-2">
                <div><span className="font-semibold text-white">Order ID:</span> {inspectingOrder.id}</div>
                <div><span className="font-semibold text-white">Pickup Location:</span> {inspectingOrder.pickupAddress} (Pincode: {inspectingOrder.pickupPincode})</div>
                <div><span className="font-semibold text-white">Drop Location:</span> {inspectingOrder.dropAddress} (Pincode: {inspectingOrder.dropPincode})</div>
                <div><span className="font-semibold text-white">Actual Weight:</span> {inspectingOrder.actualWeight} kg</div>
                <div><span className="font-semibold text-white">Dimensions:</span> {inspectingOrder.length}x{inspectingOrder.width}x{inspectingOrder.height} cm</div>
              </div>

              <div className="pt-2">
                <span className="text-xs font-bold text-white block mb-3">Audit Timeline Trails</span>
                <div className="space-y-4">
                  {inspectingOrder.statusHistory?.map((hist: any, idx: number) => (
                    <div key={hist.id} className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-lm-amber shrink-0 mt-1"></div>
                        {idx !== inspectingOrder.statusHistory.length - 1 && (
                          <div className="w-0.5 bg-lm-line grow mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-semibold text-white">{hist.status}</span>
                          <span className="text-[10px] text-lm-fog-dim lm-mono">
                            {new Date(hist.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-lm-fog-dim text-xs">{hist.notes || `Status changed to ${hist.status}`}</p>
                        <div className="text-[10px] text-lm-fog-dim mt-1 italic">
                          By {hist.actorRole} ({hist.actorId})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
