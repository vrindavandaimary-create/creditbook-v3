/**
 * PartyDetail.js — Reminder Integration Patch
 *
 * Make these 5 targeted edits to:
 *   frontend/src/pages/parties/PartyDetail.js
 *
 * ─────────────────────────────────────────────────────────────
 * EDIT 1 of 5 — Add imports (top of file, with other imports)
 * ─────────────────────────────────────────────────────────────
 * FIND the existing import block and ADD these two lines:
 *
 *   import ReminderModal from '../../components/notifications/ReminderModal';
 *   import { reminderAPI } from '../../api';
 *
 *
 * ─────────────────────────────────────────────────────────────
 * EDIT 2 of 5 — Add state (inside PartyDetail function body)
 * ─────────────────────────────────────────────────────────────
 * FIND:
 *   const [party,  setParty]  = useState(null);
 *
 * ADD after it:
 *   const [reminders,         setReminders]         = useState([]);
 *   const [showReminderModal, setShowReminderModal] = useState(false);
 *
 *
 * ─────────────────────────────────────────────────────────────
 * EDIT 3 of 5 — Load reminders inside the load() useCallback
 * ─────────────────────────────────────────────────────────────
 * FIND (inside the `load` useCallback, after both setParty and setTxs are called):
 *
 *   setTxs(partyRes.value.data.data.transactions || []);
 *
 * ADD after it:
 *
 *   const rRes = await reminderAPI.getAll({ partyId: id, active: true }).catch(() => null);
 *   if (rRes?.data?.success) setReminders(rRes.data.data);
 *
 *
 * ─────────────────────────────────────────────────────────────
 * EDIT 4 of 5 — Add "Set Reminder" button in the action bar
 * ─────────────────────────────────────────────────────────────
 * FIND the section where the ⋮ menu button (showMenu) is rendered
 * in the sticky header. It looks like:
 *
 *   <button onClick={()=>{ setShowMenu(true); ...
 *
 * ADD a new button BEFORE that button:
 */

// Paste this JSX button before the ⋮ menu button:
const SetReminderButton = (
  <button
    onClick={() => setShowReminderModal(true)}
    style={{
      width: 36, height: 36, borderRadius: '50%',
      background: '#f0f4ff', border: '1.5px solid #1a4fd6',
      cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: 16, flexShrink: 0,
    }}
    title="Set Reminder"
  >
    🔔
  </button>
);

/**
 * ─────────────────────────────────────────────────────────────
 * EDIT 5 of 5 — Add active-reminders strip + modal to JSX return
 * ─────────────────────────────────────────────────────────────
 * FIND the line in the return() where the balance card / party info ends.
 * Usually just before the transactions list starts.
 * ADD the active reminders strip there:
 */

// Active reminders strip — paste directly into JSX:
const ActiveRemindersStrip = reminders.length > 0 && (
  <div style={{
    margin: '0 16px 12px', padding: '10px 14px',
    background: '#fff7e6', borderRadius: 12,
    border: '1.5px solid #f59e0b',
  }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 6 }}>
      ⏰ Active Reminders ({reminders.length})
    </div>
    {reminders.map(r => {
      const ICONS = { payment_due: '📅', follow_up: '🔔', balance_milestone: '⚠️', recurring: '🔁' };
      return (
        <div key={r._id} style={{
          fontSize: 13, color: '#555', marginBottom: 3,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>{ICONS[r.type] || '🔔'}</span>
          <span style={{ fontWeight: 600 }}>{r.title}</span>
          {r.dueDate && (
            <span style={{ color: '#aaa', fontSize: 11, marginLeft: 'auto' }}>
              {new Date(r.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
      );
    })}
  </div>
);

// Reminder modal — paste at the very END of the return(), just before the closing </div>:
const ReminderModalJSX = showReminderModal && party && (
  <ReminderModal
    party={party}
    onClose={() => setShowReminderModal(false)}
    onCreated={(newReminder) => setReminders(prev => [newReminder, ...prev])}
  />
);
