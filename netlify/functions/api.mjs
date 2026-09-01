import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const store = getStore("tiki-tiki-gank");

const LEVELS = [
  "Member",
  "Fans",
  "Tiki",
  "Tiki - Tiki",
  "Tiki Elite",
  "Tiki Master",
  "Tiki Legend"
];

const DEFAULT_DATA = {
  site: {
    title: "Tiki Tiki Gank",
    intro: "Selamat datang di komunitas Tiki Tiki Gank!",
    benefits: [
      "Bergabung dengan komunitas Tiki Tiki Gank",
      "Mendapatkan quest dari host",
      "Menaikkan kasta member",
      "Mendapatkan pengalaman dan penghargaan"
    ]
  },
  members: []
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function getData() {
  const data = await store.get("data", { type: "json" });
  return data || structuredClone(DEFAULT_DATA);
}

async function saveData(data) {
  await store.setJSON("data", data);
}

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

function cleanMember(member) {
  return {
    id: member.id,
    username: member.username,
    name: member.name,
    level: member.level,
    quests: member.quests || []
  };
}

export default async (req) => {
  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const action = url.searchParams.get("action");

      if (action === "public") {
        const data = await getData();

        return json({
          site: data.site
        });
      }

      return json({ ok: true });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const action = body.action;

    const data = await getData();

    // JOIN
    if (action === "join") {
      const username = String(body.username || "").trim();
      const name = String(body.name || "").trim();
      const password = String(body.memberPassword || "");

      if (!username || !name || !password) {
        return json(
          { error: "Username, nama, dan password wajib diisi." },
          400
        );
      }

      if (password.length < 6) {
        return json(
          { error: "Password minimal 6 karakter." },
          400
        );
      }

      const exists = data.members.some(
        m => m.username.toLowerCase() === username.toLowerCase()
      );

      if (exists) {
        return json(
          { error: "Username sudah digunakan." },
          409
        );
      }

      const member = {
        id: crypto.randomUUID(),
        username,
        name,
        passwordHash: hashPassword(password),
        level: "Member",
        quests: [],
        createdAt: new Date().toISOString()
      };

      data.members.push(member);
      await saveData(data);

      return json({
        ok: true,
        member: cleanMember(member)
      });
    }

    // LOGIN
    if (action === "login") {
      const username = String(body.username || "").trim();
      const password = String(body.memberPassword || "");

      const member = data.members.find(
        m => m.username.toLowerCase() === username.toLowerCase()
      );

      if (
        !member ||
        member.passwordHash !== hashPassword(password)
      ) {
        return json(
          { error: "Username atau password salah." },
          401
        );
      }

      return json({
        ok: true,
        member: cleanMember(member)
      });
    }

    // MEMBER AREA
    if (action === "member") {
      const member = data.members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return json({ error: "Member tidak ditemukan." }, 404);
      }

      return json({
        member: cleanMember(member)
      });
    }

    // ADMIN LOGIN / DATA
    if (action === "admin") {
      const password = String(body.password || "");

      // GANTI PASSWORD INI DENGAN PASSWORD HOST YANG KAMU MAU
      const ADMIN_PASSWORD = "TikiTikiHost2026!";

      if (password !== ADMIN_PASSWORD) {
        return json(
          { error: "Password host salah." },
          401
        );
      }

      return json({
        ok: true,
        site: data.site,
        members: data.members.map(cleanMember)
      });
    }

    // EDIT WEBSITE
    if (action === "admin-save") {
      if (body.password !== "TikiTikiHost2026!") {
        return json({ error: "Password host salah." }, 401);
      }

      data.site.title = String(body.title || data.site.title);
      data.site.intro = String(body.intro || data.site.intro);

      if (Array.isArray(body.benefits)) {
        data.site.benefits = body.benefits
          .map(String)
          .filter(Boolean);
      }

      await saveData(data);

      return json({ ok: true });
    }

    // ASSIGN QUEST
    if (action === "quest") {
      if (body.password !== "TikiTikiHost2026!") {
        return json({ error: "Password host salah." }, 401);
      }

      const member = data.members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return json({ error: "Member tidak ditemukan." }, 404);
      }

      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();

      if (!title || !description) {
        return json(
          { error: "Judul dan deskripsi quest wajib diisi." },
          400
        );
      }

      member.quests = member.quests || [];

      member.quests.push({
        id: crypto.randomUUID(),
        title,
        description,
        status: "pending",
        proof: "",
        reviewNote: "",
        createdAt: new Date().toISOString()
      });

      await saveData(data);

      return json({ ok: true });
    }

    // SUBMIT PROOF
    if (action === "proof") {
      const member = data.members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return json({ error: "Member tidak ditemukan." }, 404);
      }

      const quest = (member.quests || []).find(
        q => q.id === body.questId
      );

      if (!quest) {
        return json({ error: "Quest tidak ditemukan." }, 404);
      }

      quest.proof = String(body.proof || "").trim();
      quest.status = "pending";
      quest.reviewNote = "";

      await saveData(data);

      return json({ ok: true });
    }

    // APPROVE / REJECT QUEST
    if (action === "review") {
      if (body.password !== "TikiTikiHost2026!") {
        return json({ error: "Password host salah." }, 401);
      }

      const member = data.members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return json({ error: "Member tidak ditemukan." }, 404);
      }

      const quest = (member.quests || []).find(
        q => q.id === body.questId
      );

      if (!quest) {
        return json({ error: "Quest tidak ditemukan." }, 404);
      }

      if (body.approved) {
        quest.status = "approved";
        quest.reviewNote = "";

        // Naik kasta setelah quest disetujui
        const index = LEVELS.indexOf(member.level);

        if (index >= 0 && index < LEVELS.length - 1) {
          member.level = LEVELS[index + 1];
        }
      } else {
        quest.status = "rejected";
        quest.reviewNote = String(body.note || "");
      }

      await saveData(data);

      return json({ ok: true });
    }

    // PROMOTE MEMBER
    if (action === "promote") {
      if (body.password !== "TikiTikiHost2026!") {
        return json({ error: "Password host salah." }, 401);
      }

      const member = data.members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return json({ error: "Member tidak ditemukan." }, 404);
      }

      const level = String(body.level || "");

      if (!LEVELS.includes(level)) {
        return json({ error: "Kasta tidak valid." }, 400);
      }

      member.level = level;

      await saveData(data);

      return json({ ok: true });
    }

    // REMOVE MEMBER
    if (action === "remove") {
      if (body.password !== "TikiTikiHost2026!") {
        return json({ error: "Password host salah." }, 401);
      }

      const before = data.members.length;

      data.members = data.members.filter(
        m => m.id !== body.memberId
      );

      if (data.members.length === before) {
        return json({ error: "Member tidak ditemukan." }, 404);
      }

      await saveData(data);

      return json({ ok: true });
    }

    return json(
      { error: "Action tidak dikenal." },
      400
    );

  } catch (error) {
    console.error(error);

    return json(
      {
        error: "Server error.",
        detail: error.message
      },
      500
    );
  }
};
