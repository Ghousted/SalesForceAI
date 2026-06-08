import type { CrmSnapshot } from "./types";

/**
 * Synthetic, sanitized data pack — Ayala Land real-estate sales.
 *
 * Privacy-first (PRD §8): the platform runs and demos entirely on this
 * fabricated data. No live PII. Names, emails and phone numbers are invented.
 * In production the same shape points at the client's governed CRM.
 *
 * "Today" for this pack is 2026-06-08.
 */
export const SYNTHETIC_SNAPSHOT: CrmSnapshot = {
  reps: [
    { id: "rep_maya", name: "Maya Reyes", role: "rep" },
    { id: "rep_jio", name: "Jio Tan", role: "rep" },
    { id: "mgr_carlo", name: "Carlo Mendoza", role: "manager" },
  ],

  companies: [
    {
      id: "co_meridian",
      name: "Meridian Capital Partners",
      industry: "Private equity",
      location: "Makati CBD",
      notes:
        "Mid-size PE firm. Several partners relocating to BGC; corporate housing budget approved for 2026.",
    },
    {
      id: "co_sunbright",
      name: "Sunbright Logistics",
      industry: "Logistics & warehousing",
      location: "Laguna",
      notes: "Family-owned. Founder buying a second home near Nuvali.",
    },
    {
      id: "co_private",
      name: "Private buyer",
      industry: "—",
      location: "Cebu",
      notes: "Individual investor, not tied to a company.",
    },
  ],

  contacts: [
    {
      id: "ct_elena",
      firstName: "Elena",
      lastName: "Villanueva",
      title: "Managing Partner",
      companyId: "co_meridian",
      email: "elena.v@meridiancap.example",
      phone: "+63 917 555 0142",
      persona:
        "Decisive, time-poor, numbers-first. Relocating from Singapore. Wants a turnkey BGC unit close to international schools. Has viewed two competitor developments already.",
      ownerRepId: "rep_maya",
    },
    {
      id: "ct_ramon",
      firstName: "Ramon",
      lastName: "Dela Cruz",
      title: "Founder & CEO",
      companyId: "co_sunbright",
      email: "ramon@sunbright.example",
      phone: "+63 918 555 0177",
      persona:
        "Relationship-driven, cautious, values family. Buying a weekend home near Nuvali. Sensitive to pushy selling; responds to patience and local knowledge.",
      ownerRepId: "rep_maya",
    },
    {
      id: "ct_grace",
      firstName: "Grace",
      lastName: "Lim",
      title: "Private investor",
      companyId: "co_private",
      email: "grace.lim@example.com",
      phone: "+63 919 555 0190",
      persona:
        "Yield-focused investor comparing pre-selling condo units for rental income. Analytical, asks for ROI and turnover timelines. Currently lukewarm.",
      ownerRepId: "rep_maya",
    },
  ],

  deals: [
    {
      id: "dl_elena_bgc",
      name: "Villanueva — Park Central Tower 2BR",
      contactId: "ct_elena",
      companyId: "co_meridian",
      stage: "proposal",
      amount: 38500000,
      property: "Park Central Towers, BGC — 2BR corner unit, 34th floor",
      expectedCloseDate: "2026-06-30",
      ownerRepId: "rep_maya",
      repConfidence: 80,
    },
    {
      id: "dl_ramon_nuvali",
      name: "Dela Cruz — Nuvali lakeside lot",
      contactId: "ct_ramon",
      companyId: "co_sunbright",
      stage: "viewing-scheduled",
      amount: 21000000,
      property: "Nuvali, Sta. Rosa — lakeside residential lot, 480 sqm",
      expectedCloseDate: "2026-07-20",
      ownerRepId: "rep_maya",
      repConfidence: 55,
    },
    {
      id: "dl_grace_presell",
      name: "Lim — pre-selling studio (investment)",
      contactId: "ct_grace",
      companyId: "co_private",
      stage: "qualifying",
      amount: 9200000,
      property: "Vertis North, QC — pre-selling studio unit",
      expectedCloseDate: "2026-08-15",
      ownerRepId: "rep_maya",
      repConfidence: 60,
    },
  ],

  activities: [
    // Elena — hot, proposal stage, a quiet signal the rep may have missed.
    {
      id: "ac_e1",
      contactId: "ct_elena",
      dealId: "dl_elena_bgc",
      type: "meeting",
      timestamp: "2026-05-28T03:00:00Z",
      subject: "Discovery meeting",
      body: "Met at Makati office. Relocating from Singapore in Q3. Two kids — wants proximity to BGC international schools. Budget comfortable up to ~PHP 40M. Wants a unit she can move into without renovation.",
    },
    {
      id: "ac_e2",
      contactId: "ct_elena",
      dealId: "dl_elena_bgc",
      type: "email",
      direction: "outbound",
      timestamp: "2026-06-01T09:10:00Z",
      subject: "Park Central 2BR — proposal & floor plans",
      body: "Sent formal proposal for the 34th-floor corner unit with payment terms and floor plans.",
    },
    {
      id: "ac_e3",
      contactId: "ct_elena",
      dealId: "dl_elena_bgc",
      type: "email",
      direction: "inbound",
      timestamp: "2026-06-05T11:42:00Z",
      subject: "Re: Park Central 2BR — proposal & floor plans",
      body: "Looks promising. One concern — my husband asked whether the building allows short-term leasing if our plans change. Also, can we move the call to Tuesday? Thanks.",
    },

    // Ramon — relationship sell, viewing booked.
    {
      id: "ac_r1",
      contactId: "ct_ramon",
      dealId: "dl_ramon_nuvali",
      type: "call",
      direction: "outbound",
      timestamp: "2026-05-30T07:30:00Z",
      subject: "Intro call",
      body: "Warm. Wants a weekend place for the family near Nuvali. Mentioned his daughter's wedding in November — timing matters. Did not like being rushed by a previous agent elsewhere.",
    },
    {
      id: "ac_r2",
      contactId: "ct_ramon",
      dealId: "dl_ramon_nuvali",
      type: "viewing",
      timestamp: "2026-06-11T02:00:00Z",
      subject: "Site viewing — Nuvali lakeside",
      body: "Scheduled on-site viewing of the lakeside lot. Bringing his wife.",
    },

    // Grace — investor, lukewarm, price/ROI focused.
    {
      id: "ac_g1",
      contactId: "ct_grace",
      dealId: "dl_grace_presell",
      type: "email",
      direction: "inbound",
      timestamp: "2026-06-03T01:20:00Z",
      subject: "ROI on pre-selling studio?",
      body: "Comparing three pre-selling projects. Can you share projected rental yield and turnover date? I'm not in a rush.",
    },
    {
      id: "ac_g2",
      contactId: "ct_grace",
      dealId: "dl_grace_presell",
      type: "note",
      timestamp: "2026-06-04T06:00:00Z",
      subject: "Internal note",
      body: "Rep logged confidence at 60% but has not yet sent the ROI breakdown she asked for. Risk of going cold.",
    },
  ],
};
