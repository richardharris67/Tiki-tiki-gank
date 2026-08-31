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

const DEFAULT_SITE = {
  title: "Tiki Tiki Gank",
  intro: "Selamat datang di komunitas Tiki Tiki Gank!",
  benefits: [
    "Ikuti quest seru dari host",
    "Kumpulkan bukti dan naik kasta",
    "Ikuti aktivitas khusus member"
  ]
};

function response(data, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

async function getData(key, fallback) {
  const data = await store.get(key, { type: "json" });
  return data ?? fallback;
}

async function saveData(key, data) {
  await store.setJSON(key, data);
}

function makePassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return { salt, hash };
}

function checkPassword(password, salt, hash) {
  const calculated = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(calculated, "hex"),
    Buffer.from(hash, "hex")
  );
}

function safeMember(member) {
  return {
    id: member.id,
    username: member.username,
    name: member.name,
    level: member.level,
    joinedAt: member.joinedAt,
    quests: member.quests || []
  };
}

function isAdmin(body) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) return false;

  return body.password === adminPassword;
}

export default async (event) => {
  try {
    let body = {};

    if (event.body) {
      body = JSON.parse(event.body);
    }

    const action =
      body.action ||
      event.queryStringParameters?.action;

    // PUBLIC WEBSITE
    if (action === "public") {
      const site = await getData(
        "site",
        DEFAULT_SITE
      );

      return response({
        ok: true,
        site,
        publicFollowers: "25,000,000+"
      });
    }

    // JOIN MEMBER
    if (action === "join") {
      const username = String(body.username || "").trim();
      const name = String(body.name || "").trim();
      const password = String(
        body.memberPassword || ""
      );

      if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) {
        return response({
          error:
            "Username harus 3-24 karakter dan hanya boleh memakai huruf, angka, titik, _ atau -."
        }, 400);
      }

      if (name.length < 2) {
        return response({
          error: "Nama harus diisi."
        }, 400);
      }

      if (password.length < 6) {
        return response({
          error: "Password minimal 6 karakter."
        }, 400);
      }

      const members = await getData(
        "members",
        []
      );

      const exists = members.some(
        member =>
          member.username.toLowerCase() ===
          username.toLowerCase()
      );

      if (exists) {
        return response({
          error:
            "Username sudah digunakan. Silakan gunakan username lain atau LOGIN."
        }, 409);
      }

      const passwordData =
        makePassword(password);

      const member = {
        id: crypto.randomUUID(),
        username,
        name,
        passwordHash: passwordData.hash,
        passwordSalt: passwordData.salt,
        level: "Member",
        joinedAt: new Date().toISOString(),
        quests: []
      };

      members.push(member);

      await saveData(
        "members",
        members
      );

      return response({
        ok: true,
        member: safeMember(member)
      });
    }

    // LOGIN MEMBER
    if (action === "login") {
      const username = String(
        body.username || ""
      ).trim();

      const password = String(
        body.memberPassword || ""
      );

      const members = await getData(
        "members",
        []
      );

      const member = members.find(
        m =>
          m.username.toLowerCase() ===
          username.toLowerCase()
      );

      if (!member) {
        return response({
          error: "Username atau password salah."
        }, 401);
      }

      const valid = checkPassword(
        password,
        member.passwordSalt,
        member.passwordHash
      );

      if (!valid) {
        return response({
          error: "Username atau password salah."
        }, 401);
      }

      return response({
        ok: true,
        member: safeMember(member)
      });
    }

    // MEMBER AREA
    if (action === "member") {
      const members = await getData(
        "members",
        []
      );

      const member = members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return response({
          error: "Member tidak ditemukan."
        }, 404);
      }

      return response({
        ok: true,
        member: safeMember(member)
      });
    }

    // EVERYTHING BELOW REQUIRES HOST PASSWORD

    if (!isAdmin(body)) {
      return response({
        error:
          "Password host salah atau ADMIN_PASSWORD belum diatur di Netlify."
      }, 401);
    }

    // ADMIN DASHBOARD
    if (action === "admin") {
      return response({
        ok: true,
        levels: LEVELS,
        hosts: [
          "Richard Harris Phang",
          "Jason Vilbert",
          "Kenward Alvaro Viryatandi"
        ],
        site: await getData(
          "site",
          DEFAULT_SITE
        ),
        members: await getData(
          "members",
          []
        )
      });
    }

    // EDIT WEBSITE
    if (action === "admin-save") {
      const site = {
        title: String(
          body.title || DEFAULT_SITE.title
        ).slice(0, 80),

        intro: String(
          body.intro || ""
        ).slice(0, 500),

        benefits: Array.isArray(body.benefits)
          ? body.benefits
              .map(String)
              .filter(Boolean)
              .slice(0, 10)
          : []
      };

      await saveData(
        "site",
        site
      );

      return response({
        ok: true,
        site
      });
    }

    // GIVE QUEST
    if (action === "quest") {
      const members = await getData(
        "members",
        []
      );

      const member = members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return response({
          error: "Member tidak ditemukan."
        }, 404);
      }

      if (!member.quests) {
        member.quests = [];
      }

      member.quests.push({
        id: crypto.randomUUID(),
        title: String(
          body.title || "Quest"
        ).slice(0, 100),
        description: String(
          body.description || ""
        ).slice(0, 1000),
        status: "assigned",
        proof: "",
        reviewNote: ""
      });

      await saveData(
        "members",
        members
      );

      return response({
        ok: true
      });
    }

    // MEMBER SUBMITS PROOF
    if (action === "proof") {
      const members = await getData(
        "members",
        []
      );

      const member = members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return response({
          error: "Member tidak ditemukan."
        }, 404);
      }

      const quest = (member.quests || []).find(
        q => q.id === body.questId
      );

      if (!quest) {
        return response({
          error: "Quest tidak ditemukan."
        }, 404);
      }

      quest.proof = String(
        body.proof || ""
      ).slice(0, 3000);

      quest.status = "pending";

      await saveData(
        "members",
        members
      );

      return response({
        ok: true
      });
    }

    // HOST REVIEWS QUEST
    if (action === "review") {
      const members = await getData(
        "members",
        []
      );

      const member = members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return response({
          error: "Member tidak ditemukan."
        }, 404);
      }

      const quest = (member.quests || []).find(
        q => q.id === body.questId
      );

      if (!quest) {
        return response({
          error: "Quest tidak ditemukan."
        }, 404);
      }

      quest.status =
        body.approved === true
          ? "approved"
          : "rejected";

      quest.reviewNote = String(
        body.note || ""
      ).slice(0, 500);

      await saveData(
        "members",
        members
      );

      return response({
        ok: true
      });
    }

    // CHANGE MEMBER LEVEL
    if (action === "promote") {
      const members = await getData(
        "members",
        []
      );

      const member = members.find(
        m => m.id === body.memberId
      );

      if (!member) {
        return response({
          error: "Member tidak ditemukan."
        }, 404);
      }

      if (!LEVELS.includes(body.level)) {
        return response({
          error: "Kasta tidak valid."
        }, 400);
      }

      member.level = body.level;

      await saveData(
        "members",
        members
      );

      return response({
        ok: true
      });
    }

    // REMOVE MEMBER
    if (action === "remove") {
      const members = await getData(
        "members",
        []
      );

      const remaining =
        members.filter(
          m => m.id !== body.memberId
        );

      await saveData(
        "members",
        remaining
      );

      return response({
        ok: true
      });
    }

    return response({
      error: "Action tidak dikenal."
    }, 400);

  } catch (error) {
    console.error(error);

    return response({
      error:
        "Terjadi kesalahan server: " +
        error.message
    }, 500);
  }
};
