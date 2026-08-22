import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Package, Navigation, MapPin } from 'lucide-react';
import TrackingScreen from './TrackingScreen';

interface CustomerDashboardProps {
  token: string;
  user: any;
  onLogout: () => void;
}

export default function CustomerDashboard({ token, user, onLogout }: CustomerDashboardProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [mappings, setMappings] = useState<any[]>([]);

  // Form State
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPincode, setPickupPincode] = useState('560001'); // Default seeded
  const [pickupLat, setPickupLat] = useState(12.9716);
  const [pickupLng, setPickupLng] = useState(77.5946);

  const [dropAddress, setDropAddress] = useState('');
  const [dropPincode, setDropPincode] = useState('560038'); // Default seeded
  const [dropLat, setDropLat] = useState(12.9784);
  const [dropLng, setDropLng] = useState(77.6408);

  const PINCODE_COORDINATES: Record<string, { lat: number; lng: number }> = {
    '560001': { lat: 12.9716, lng: 77.5946 },
    '560038': { lat: 12.9784, lng: 77.6408 },
    '560066': { lat: 12.9668, lng: 77.7499 }
  };

  const handlePickupPincodeChange = (pincode: string) => {
    setPickupPincode(pincode);
    const coords = PINCODE_COORDINATES[pincode];
    if (coords) {
      setPickupLat(coords.lat);
      setPickupLng(coords.lng);
    }
  };

  const handleDropPincodeChange = (pincode: string) => {
    setDropPincode(pincode);
    const coords = PINCODE_COORDINATES[pincode];
    if (coords) {
      setDropLat(coords.lat);
      setDropLng(coords.lng);
    }
  };

  const [length, setLength] = useState(10);
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(10);
  const [actualWeight, setActualWeight] = useState(1.0);
  const [orderType, setOrderType] = useState<'B2B' | 'B2C'>('B2C');
  const [paymentType, setPaymentType] = useState<'PREPAID' | 'COD'>('PREPAID');

  const [calculation, setCalculation] = useState<any>(null);
  const [calcError, setCalcError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  const fetchZones = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/zones');
      const allMappings: any[] = [];
      res.data.forEach((zone: any) => {
        if (zone.mappings) {
          zone.mappings.forEach((m: any) => {
            allMappings.push({
              pincode: m.pincode,
              areaName: m.areaName,
              zoneName: zone.name
            });
          });
        }
      });
      setMappings(allMappings);
      
      if (allMappings.length > 0) {
        const currentPickupVal = allMappings[0].pincode;
        setPickupPincode(currentPickupVal);
        const pCoords = PINCODE_COORDINATES[currentPickupVal] || { lat: 12.9716, lng: 77.5946 };
        setPickupLat(pCoords.lat);
        setPickupLng(pCoords.lng);

        const currentDropVal = allMappings.length > 1 ? allMappings[1].pincode : allMappings[0].pincode;
        setDropPincode(currentDropVal);
        const dCoords = PINCODE_COORDINATES[currentDropVal] || { lat: 12.9716, lng: 77.5946 };
        setDropLat(dCoords.lat);
        setDropLng(dCoords.lng);
      }
    } catch (err) {
      console.error('Error fetching zones:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchZones();
  }, [token]);

  // Recalculate rate whenever form inputs change
  useEffect(() => {
    const calculate = async () => {
      setCalcError('');
      if (!pickupPincode || !dropPincode || !length || !width || !height || !actualWeight) {
        return;
      }
      try {
        const res = await axios.post('http://localhost:5000/api/rates/calculate', {
          pickupPincode,
          dropPincode,
          length: Number(length),
          width: Number(width),
          height: Number(height),
          actualWeight: Number(actualWeight),
          orderType,
          paymentType
        });
        setCalculation(res.data);
      } catch (err: any) {
        setCalculation(null);
        setCalcError(err.response?.data?.error || 'Rate calculation failed. Ensure pincodes are correct.');
      }
    };

    const timer = setTimeout(calculate, 300);
    return () => clearTimeout(timer);
  }, [pickupPincode, dropPincode, length, width, height, actualWeight, orderType, paymentType]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitLoading(true);

    try {
      await axios.post(
        'http://localhost:5000/api/orders',
        {
          pickupAddress,
          pickupPincode,
          pickupLat: Number(pickupLat),
          pickupLng: Number(pickupLng),
          dropAddress,
          dropPincode,
          dropLat: Number(dropLat),
          dropLng: Number(dropLng),
          length: Number(length),
          width: Number(width),
          height: Number(height),
          actualWeight: Number(actualWeight),
          orderType,
          paymentType
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsCreateOpen(false);
      // Reset form
      setPickupAddress('');
      setDropAddress('');
      fetchOrders();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error;
      if (Array.isArray(errorMsg)) {
        const message = errorMsg.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        setSubmitError(message);
      } else if (typeof errorMsg === 'string') {
        setSubmitError(errorMsg);
      } else {
        setSubmitError('Failed to place order.');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  if (selectedOrderId) {
    return (
      <div className="py-8 px-4 bg-lm-ink min-h-screen">
        <TrackingScreen
          orderId={selectedOrderId}
          token={token}
          onBack={() => {
            setSelectedOrderId(null);
            fetchOrders();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lm-ink p-6 text-[#C7CDD6]">
      {/* Top Navigation */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-lm-line pb-6">
        <div>
          <div className="text-2xl font-bold text-white lm-display">
            LASTMILE<span className="text-lm-amber">.</span>
          </div>
          <div className="text-xs text-lm-fog-dim mt-1">Logged in as {user.email} (Customer)</div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 bg-lm-amber text-lm-ink font-bold px-4 py-2 rounded-lg text-sm hover:bg-opacity-90"
          >
            <Plus size={16} /> Place New Order
          </button>
          <button
            onClick={onLogout}
            className="text-sm font-medium border border-lm-line text-lm-fog-dim px-4 py-2 rounded-lg hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-6xl mx-auto">
        <h3 className="text-lg font-bold text-white mb-6 lm-display">Your Delivery Orders</h3>

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-lm-steel rounded-2xl border border-lm-line">
            <Package size={48} className="mx-auto text-lm-fog-dim mb-4" />
            <h4 className="text-lg font-semibold text-white">No Orders Placed Yet</h4>
            <p className="text-lm-fog-dim text-sm mt-1 max-w-xs mx-auto">
              Create your first package delivery order by clicking 'Place New Order' above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => {
              let breakdown: any = {};
              try {
                breakdown = typeof order.chargeBreakdown === 'string'
                  ? JSON.parse(order.chargeBreakdown)
                  : (order.chargeBreakdown || {});
              } catch (e) {
                console.error('Failed to parse charge breakdown:', e);
              }
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="bg-lm-steel border border-lm-line hover:border-lm-amber rounded-xl p-5 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-mono text-lm-fog-dim">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                          order.currentStatus === 'DELIVERED'
                            ? 'border-lm-teal text-lm-teal bg-lm-teal/10'
                            : order.currentStatus === 'FAILED'
                            ? 'border-lm-red text-lm-red bg-lm-red/10'
                            : 'border-lm-amber text-lm-amber bg-lm-amber/10'
                        }`}
                      >
                        {order.currentStatus}
                      </span>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex gap-2">
                        <MapPin size={16} className="text-lm-amber shrink-0" />
                        <div>
                          <div className="text-[10px] text-lm-fog-dim">PICKUP</div>
                          <div className="text-xs text-white line-clamp-1">{order.pickupAddress}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Navigation size={16} className="text-lm-teal shrink-0" />
                        <div>
                          <div className="text-[10px] text-lm-fog-dim">DROP</div>
                          <div className="text-xs text-white line-clamp-1">{order.dropAddress}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-lm-line pt-3 mt-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="text-[10px] text-lm-fog-dim">DELIVERY CHARGE</div>
                      <div className="font-semibold text-white lm-mono">₹{breakdown.totalCharge}</div>
                    </div>
                    {order.agent ? (
                      <div className="text-right">
                        <div className="text-[10px] text-lm-fog-dim">AGENT</div>
                        <div className="text-white font-medium">
                          {order.agent?.user?.email ? order.agent.user.email.split('@')[0] : 'Assigned'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-right text-[10px] text-lm-amber font-medium bg-lm-amber/10 px-2 py-0.5 rounded">
                        Awaiting Agent
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Place Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-lm-steel border border-lm-line rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white lm-display">Place New Delivery Order</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-lm-fog-dim hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-lm-red/20 border border-lm-red rounded text-xs text-red-300">
                {submitError}
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-6">
              {/* Pickup & Drop Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-lm-amber uppercase mb-3">Pickup Location</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-lm-fog-dim mb-1">Pincode</label>
                      <select
                        required
                        className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-lm-amber"
                        value={pickupPincode}
                        onChange={(e) => handlePickupPincodeChange(e.target.value)}
                      >
                        {mappings.map((m) => (
                          <option key={m.pincode} value={m.pincode}>
                            {m.pincode} ({m.zoneName} — {m.areaName})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-lm-fog-dim mb-1">Full Pickup Address</label>
                      <textarea
                        required
                        rows={2}
                        className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-lm-amber"
                        placeholder="123 Central Ave, Block A"
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-lm-fog-dim mb-0.5">Lat</label>
                        <input
                          type="number"
                          step="any"
                          required
                          className="w-full bg-lm-steel-2 border border-lm-line rounded px-2 py-1 text-white text-xs focus:outline-none"
                          value={pickupLat}
                          onChange={(e) => setPickupLat(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-lm-fog-dim mb-0.5">Lng</label>
                        <input
                          type="number"
                          step="any"
                          required
                          className="w-full bg-lm-steel-2 border border-lm-line rounded px-2 py-1 text-white text-xs focus:outline-none"
                          value={pickupLng}
                          onChange={(e) => setPickupLng(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-lm-teal uppercase mb-3">Drop Location</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-lm-fog-dim mb-1">Pincode</label>
                      <select
                        required
                        className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-lm-amber"
                        value={dropPincode}
                        onChange={(e) => handleDropPincodeChange(e.target.value)}
                      >
                        {mappings.map((m) => (
                          <option key={m.pincode} value={m.pincode}>
                            {m.pincode} ({m.zoneName} — {m.areaName})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-lm-fog-dim mb-1">Full Drop Address</label>
                      <textarea
                        required
                        rows={2}
                        className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-lm-amber"
                        placeholder="789 Indiranagar Main Rd"
                        value={dropAddress}
                        onChange={(e) => setDropAddress(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-lm-fog-dim mb-0.5">Lat</label>
                        <input
                          type="number"
                          step="any"
                          required
                          className="w-full bg-lm-steel-2 border border-lm-line rounded px-2 py-1 text-white text-xs focus:outline-none"
                          value={dropLat}
                          onChange={(e) => setDropLat(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-lm-fog-dim mb-0.5">Lng</label>
                        <input
                          type="number"
                          step="any"
                          required
                          className="w-full bg-lm-steel-2 border border-lm-line rounded px-2 py-1 text-white text-xs focus:outline-none"
                          value={dropLng}
                          onChange={(e) => setDropLng(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Package Details */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase mb-3">Package Dimensions & Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-lm-fog-dim mb-1">Length (cm)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-1.5 text-white text-xs"
                      value={length}
                      onChange={(e) => setLength(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-lm-fog-dim mb-1">Width (cm)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-1.5 text-white text-xs"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-lm-fog-dim mb-1">Height (cm)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-1.5 text-white text-xs"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-lm-fog-dim mb-1">Actual Weight (kg)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0.1"
                      className="w-full bg-lm-steel-2 border border-lm-line rounded px-3 py-1.5 text-white text-xs"
                      value={actualWeight}
                      onChange={(e) => setActualWeight(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Order & Payment configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-lm-fog mb-2">Order Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`py-2 px-4 border rounded text-xs font-bold transition-all ${
                        orderType === 'B2C'
                          ? 'border-lm-amber bg-lm-amber/10 text-white'
                          : 'border-lm-line bg-lm-steel-2 text-lm-fog-dim'
                      }`}
                      onClick={() => setOrderType('B2C')}
                    >
                      B2C (Retail)
                    </button>
                    <button
                      type="button"
                      className={`py-2 px-4 border rounded text-xs font-bold transition-all ${
                        orderType === 'B2B'
                          ? 'border-lm-amber bg-lm-amber/10 text-white'
                          : 'border-lm-line bg-lm-steel-2 text-lm-fog-dim'
                      }`}
                      onClick={() => setOrderType('B2B')}
                    >
                      B2B (Enterprise)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-lm-fog mb-2">Payment Option</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`py-2 px-4 border rounded text-xs font-bold transition-all ${
                        paymentType === 'PREPAID'
                          ? 'border-lm-amber bg-lm-amber/10 text-white'
                          : 'border-lm-line bg-lm-steel-2 text-lm-fog-dim'
                      }`}
                      onClick={() => setPaymentType('PREPAID')}
                    >
                      Prepaid
                    </button>
                    <button
                      type="button"
                      className={`py-2 px-4 border rounded text-xs font-bold transition-all ${
                        paymentType === 'COD'
                          ? 'border-lm-amber bg-lm-amber/10 text-white'
                          : 'border-lm-line bg-lm-steel-2 text-lm-fog-dim'
                      }`}
                      onClick={() => setPaymentType('COD')}
                    >
                      Cash on Delivery (COD)
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Rate Engine Breakdown Pre-Confirmation */}
              <div className="bg-lm-steel-2 border border-lm-line rounded-xl p-4 mt-6">
                <span className="text-xs font-bold uppercase tracking-wider text-lm-fog-dim">
                  Live Billable Cost Breakdown
                </span>

                {calcError && (
                  <div className="text-xs text-red-300 mt-2 p-2 bg-lm-red/10 border border-lm-red/30 rounded">
                    {calcError}
                  </div>
                )}

                {calculation ? (
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-lm-fog-dim">Zone Connection:</span>
                      <span className="text-white font-medium">
                        {calculation.pickupZoneName} → {calculation.dropZoneName} ({calculation.zoneType})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-lm-fog-dim">Billed Weight:</span>
                      <span className="text-white font-medium">
                        {calculation.billableWeight} kg{' '}
                        {calculation.volumetricWeight > calculation.actualWeight ? (
                          <span className="text-lm-amber font-normal">
                            (Volumetric {calculation.volumetricWeight} kg &gt; Actual {calculation.actualWeight} kg)
                          </span>
                        ) : (
                          <span className="text-lm-fog-dim font-normal">
                            (Actual Weight Billed)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-lm-fog-dim">Base Zone Cost (Card: ₹{calculation.baseRate} + ₹{calculation.perKgRate}/kg):</span>
                      <span className="text-white font-medium lm-mono">₹{calculation.baseCharge}</span>
                    </div>
                    {calculation.codSurcharge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-lm-fog-dim">COD Surcharge Applied ({orderType}):</span>
                        <span className="text-white font-medium lm-mono">₹{calculation.codSurcharge}</span>
                      </div>
                    )}
                    <div className="border-t border-lm-line pt-2 mt-2 flex justify-between font-bold text-sm text-white">
                      <span>Total Billed Amount:</span>
                      <span className="text-lm-amber lm-mono">₹{calculation.totalCharge}</span>
                    </div>
                  </div>
                ) : (
                  !calcError && (
                    <div className="text-xs text-lm-fog-dim mt-2 italic">
                      Calculating cost details... Enter valid pincodes.
                    </div>
                  )
                )}
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 bg-transparent border border-lm-line text-lm-fog-dim font-bold py-2.5 rounded-lg text-xs hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading || !calculation}
                  className="flex-1 bg-lm-amber text-lm-ink font-bold py-2.5 rounded-lg text-xs hover:bg-opacity-95 disabled:opacity-50"
                >
                  {submitLoading ? 'Creating...' : 'Confirm & Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
