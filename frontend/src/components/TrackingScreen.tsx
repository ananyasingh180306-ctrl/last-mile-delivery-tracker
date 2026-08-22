import React, { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle2, MapPin, ChevronDown, Calendar, AlertTriangle } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';

interface TrackingScreenProps {
  orderId: string;
  token: string;
  onBack: () => void;
}

const STATUS_STEPS = [
  { key: 'PLACED', label: 'Order Placed', icon: Package },
  { key: 'ASSIGNED', label: 'Agent Assigned', icon: MapPin },
  { key: 'PICKED_UP', label: 'Picked Up', icon: Truck },
  { key: 'IN_TRANSIT', label: 'In Transit', icon: Truck },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 }
];

export default function TrackingScreen({ orderId, token, onBack }: TrackingScreenProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleSuccess, setRescheduleSuccess] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrder(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Setup Socket.io
    const socket = io('http://localhost:5000');

    socket.emit('joinOrderTrack', orderId);

    socket.on('orderStatusChanged', (updatedOrder: any) => {
      console.log('Socket update received for order:', updatedOrder);
      setOrder(updatedOrder);
    });

    return () => {
      socket.emit('leaveOrderTrack', orderId);
      socket.disconnect();
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lm-amber"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-lm-steel border border-lm-line rounded-xl text-center">
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Tracker</h2>
        <p className="text-lm-fog-dim mb-4">{error || 'Order not found'}</p>
        <button onClick={onBack} className="text-lm-amber font-semibold hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  // Parse breakdown JSON
  let breakdown: any = {};
  try {
    breakdown = JSON.parse(order.chargeBreakdown);
  } catch (e) {
    console.error('Error parsing breakdown snapshot:', e);
  }

  // Find step index
  const stepIndex = STATUS_STEPS.findIndex((step) => step.key === order.currentStatus);

  // If status is FAILED, stepIndex might be -1. We can treat it specially
  const isFailed = order.currentStatus === 'FAILED';

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRescheduleError('');
    setRescheduleSuccess(false);

    if (!rescheduleDate) {
      setRescheduleError('Please select a date.');
      return;
    }

    try {
      const res = await axios.post(
        `http://localhost:5000/api/orders/${orderId}/reschedule`,
        { requestedDate: rescheduleDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOrder(res.data);
      setRescheduleSuccess(true);
    } catch (err: any) {
      setRescheduleError(err.response?.data?.error || 'Failed to reschedule.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-lm-ink p-6 rounded-2xl border border-lm-line">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-sm font-medium text-lm-fog-dim hover:text-white">
          ← Back to Orders
        </button>
        <div className="lm-mono text-xs px-3 py-1 rounded-full border border-lm-line text-lm-fog-dim">
          CUSTOMER
        </div>
      </div>

      <div className="bg-lm-steel rounded-xl border border-lm-line p-6 relative overflow-hidden">
        {/* Decorative corner cutouts */}
        <div className="absolute top-1/2 left-0 w-5 h-5 bg-lm-ink rounded-full -translate-x-1/2 -translate-y-1/2 border-r border-lm-line"></div>
        <div className="absolute top-1/2 right-0 w-5 h-5 bg-lm-ink rounded-full translate-x-1/2 -translate-y-1/2 border-l border-lm-line"></div>

        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs text-lm-fog-dim lm-mono">#{order.id.substring(0, 8).toUpperCase()} - {order.orderType}</div>
            <h2 className="text-2xl font-bold text-white mt-1 lm-display">Track Your Order</h2>
          </div>
          <div
            className={`text-xs font-bold tracking-wider px-3 py-1.5 border rounded uppercase ${
              isFailed
                ? 'border-lm-red text-lm-red bg-lm-red/10'
                : order.currentStatus === 'DELIVERED'
                ? 'border-lm-teal text-lm-teal bg-lm-teal/10'
                : 'border-lm-amber text-lm-amber bg-lm-amber/10'
            }`}
          >
            {order.currentStatus}
          </div>
        </div>

        <div className="border-t border-dashed border-lm-line my-5"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-lm-fog-dim mb-6">
          <div>
            From: <b className="text-lm-fog font-medium">{breakdown.pickupZoneName || order.pickupPincode}</b>
          </div>
          <div className="md:text-right">
            To: <b className="text-lm-fog font-medium">{breakdown.dropZoneName || order.dropPincode}</b>
          </div>
          <div className="col-span-1 md:col-span-2 text-center py-1 bg-lm-steel-2 rounded text-lm-fog border border-lm-line lm-mono">
            {breakdown.zoneType} ZONE DELIVERY
          </div>
        </div>

        {/* Tracking Progress Bar */}
        {!isFailed ? (
          <div className="my-8">
            <div className="relative h-1 bg-lm-line rounded-full mx-4 mb-4">
              <div
                className="absolute top-0 left-0 h-full bg-lm-amber transition-all duration-500 rounded-full"
                style={{ width: `${(Math.max(0, stepIndex) / (STATUS_STEPS.length - 1)) * 100}%` }}
              ></div>
            </div>

            <div className="flex justify-between">
              {STATUS_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const done = idx < stepIndex;
                const current = idx === stepIndex;
                const isFinal = idx === STATUS_STEPS.length - 1;

                return (
                  <div key={step.key} className="flex flex-col items-center w-16 text-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                        current
                          ? isFinal
                            ? 'bg-lm-teal border-lm-teal text-lm-ink'
                            : 'bg-lm-amber border-lm-amber text-lm-ink'
                          : done
                          ? 'border-lm-amber text-lm-amber'
                          : 'border-lm-line text-lm-fog-dim bg-lm-steel'
                      }`}
                    >
                      <Icon size={14} />
                    </div>
                    <span
                      className={`text-[9px] mt-2 font-medium leading-tight ${
                        current ? 'text-white font-semibold' : 'text-lm-fog-dim'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="my-6 p-4 bg-lm-red/20 border border-lm-red rounded-lg flex gap-3 text-sm text-lm-fog">
            <AlertTriangle className="text-lm-red shrink-0" />
            <div>
              <span className="font-bold text-white">Delivery Attempt Failed</span>
              <p className="text-xs text-lm-fog-dim mt-1">
                The agent was unable to deliver your package. You can reschedule the attempt below.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-lm-line pt-4 mt-6">
          <button
            onClick={() => setBreakdownOpen(!breakdownOpen)}
            className="flex justify-between items-center w-full text-left"
          >
            <div>
              <span className="text-xs text-lm-fog-dim">Delivery Charge (Snapshotted)</span>
              <div className="text-2xl font-bold text-white lm-mono">₹{breakdown.totalCharge || order.charge}</div>
            </div>
            <ChevronDown
              size={20}
              className={`text-lm-fog-dim transition-transform ${breakdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {breakdownOpen && (
            <div className="mt-4 pt-4 border-t border-dashed border-lm-line space-y-2 text-xs">
              <div className="flex justify-between text-lm-fog-dim">
                <span>Base Charge</span>
                <span className="text-white font-medium lm-mono">₹{breakdown.baseRate}</span>
              </div>
              <div className="flex justify-between text-lm-fog-dim">
                <span>
                  Weight Billed ({breakdown.billableWeight}kg @ ₹{breakdown.perKgRate}/kg)
                  {breakdown.volumetricWeight > breakdown.actualWeight && (
                    <span className="text-[10px] text-lm-amber ml-1">
                      (Volumetric {breakdown.volumetricWeight}kg &gt; Actual {breakdown.actualWeight}kg)
                    </span>
                  )}
                </span>
                <span className="text-white font-medium lm-mono">
                  ₹{Math.round((breakdown.billableWeight * breakdown.perKgRate) * 100) / 100}
                </span>
              </div>
              {breakdown.codSurcharge > 0 && (
                <div className="flex justify-between text-lm-fog-dim">
                  <span>COD Surcharge ({order.orderType})</span>
                  <span className="text-white font-medium lm-mono">₹{breakdown.codSurcharge}</span>
                </div>
              )}
              <div className="border-t border-dashed border-lm-line pt-2 flex justify-between font-semibold text-white">
                <span>Total</span>
                <span className="text-lm-amber lm-mono">₹{breakdown.totalCharge}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reschedule Card if FAILED */}
      {isFailed && (
        <div className="mt-6 bg-lm-steel border border-lm-line rounded-xl p-6">
          <h3 className="font-bold text-white mb-2 flex items-center gap-2">
            <Calendar size={18} className="text-lm-amber" /> Reschedule Delivery
          </h3>
          <p className="text-xs text-lm-fog-dim mb-4">
            Select a new delivery date. We will assign a new agent and try to deliver again.
          </p>

          {rescheduleError && <div className="mb-4 text-xs text-red-300">{rescheduleError}</div>}
          {rescheduleSuccess && <div className="mb-4 text-xs text-teal-300">Rescheduled successfully!</div>}

          <form onSubmit={handleReschedule} className="flex gap-4">
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              className="flex-1 bg-lm-steel-2 border border-lm-line rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-lm-amber"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
            <button
              type="submit"
              className="bg-lm-amber text-lm-ink font-bold px-4 py-2 rounded-lg text-xs hover:bg-opacity-95"
            >
              Submit Reschedule
            </button>
          </form>
        </div>
      )}

      {/* Audit History Timeline Log */}
      <div className="mt-8">
        <h3 className="text-xs font-bold tracking-wider text-lm-fog-dim uppercase mb-4">Timeline Audit Log</h3>
        <div className="space-y-4">
          {order.statusHistory?.map((hist: any, idx: number) => (
            <div key={hist.id} className="flex gap-3 text-xs">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-lm-amber shrink-0 mt-1"></div>
                {idx !== order.statusHistory.length - 1 && (
                  <div className="w-0.5 bg-lm-line grow mt-1"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-white">{hist.status}</span>
                  <span className="text-[10px] text-lm-fog-dim lm-mono">
                    {new Date(hist.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-lm-fog-dim text-xs">{hist.notes || `Status changed to ${hist.status}`}</p>
                <div className="text-[10px] text-lm-fog-dim mt-1 italic">
                  By {hist.actorRole} ({hist.actor?.email || hist.actorId})
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
