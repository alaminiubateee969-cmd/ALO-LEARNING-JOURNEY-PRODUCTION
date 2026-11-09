import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { hashPassword } from "@/lib/auth";
import {
  createAuditLog,
  ipFromRequest,
  sanitizeInput,
} from "@/lib/security";

// GET /api/users — List users with pagination, search, and role filter
export const GET = withAuth(
  async (request) => {
    try {
      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search") || "";
      const role = searchParams.get("role") || "";
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
      );
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { isActive: true };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
        ];
      }

      if (role) {
        where.role = role;
      }

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            avatar: true,
            role: true,
            isActive: true,
            isSuperAdmin: true,
            lastLoginAt: true,
            createdAt: true,
            institutionId: true,
            institution: { select: { id: true, name: true, shortName: true } },
            roleRel: { select: { id: true, name: true, displayName: true } },
            studentProfile: { select: { studentId: true, status: true, cgpa: true } },
            employeeProfile: { select: { employeeId: true, status: true } },
          },
        }),
        db.user.count({ where }),
      ]);

      return NextResponse.json({
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error listing users:", error);
      return NextResponse.json(
        { error: "Failed to list users" },
        { status: 500 }
      );
    }
  },
  { minRole: "admin" }
);

// POST /api/users — Create a new user (admin only)
export const POST = withAuth(
  async (request, { user }) => {
    try {
      const body = await request.json();
      const rawName = String(body.name || "").trim();
      const rawEmail = String(body.email || "").trim().toLowerCase();
      const rawPassword = String(body.password || "");
      const rawPhone = String(body.phone || "").trim();
      const rawRole = String(body.role || "student").trim().toLowerCase();

      const name = sanitizeInput(rawName);
      const email = sanitizeInput(rawEmail);
      const phone = rawPhone ? sanitizeInput(rawPhone) : null;
      const role = sanitizeInput(rawRole);
      const password = rawPassword;

      // Validation
      if (!name || !email || !password) {
        return NextResponse.json(
          { error: "name, email, and password are required" },
          { status: 400 }
        );
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: "A valid email is required" },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      // Validate role
      const validRoles = ["student", "teacher", "employee", "admin", "accountant", "parent", "partner"];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
          { status: 400 }
        );
      }

      // Check for existing email
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 }
        );
      }

      // Find matching role record
      let roleRecord = await db.role.findFirst({ where: { name: role } });
      if (!roleRecord) {
        roleRecord = await db.role.create({
          data: {
            name: role,
            displayName: role.charAt(0).toUpperCase() + role.slice(1),
            description: `${role} role`,
            permissions: "{}",
            level: 10,
            isSystem: false,
          },
        });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Get first institution
      let institution = await db.institution.findFirst({
        orderBy: { createdAt: "asc" },
      });

      // Create user data
      const userData: Record<string, unknown> = {
        name,
        email,
        passwordHash,
        phone,
        role,
        roleId: roleRecord.id,
        institutionId: institution?.id || null,
      };

      // For students, create with student profile in a transaction
      let newUser;
      if (role === "student") {
        const studentCount = await db.user.count({ where: { role: "student" } });
        const studentId = `STU-${String(studentCount + 1).padStart(4, "0")}`;

        newUser = await db.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: userData as Parameters<typeof tx.user.create>[0]["data"],
            select: {
              id: true, email: true, name: true, phone: true, avatar: true,
              role: true, isActive: true, isSuperAdmin: true, createdAt: true,
              institutionId: true,
              institution: { select: { id: true, name: true, shortName: true } },
              roleRel: { select: { id: true, name: true, displayName: true } },
            },
          });

          await tx.studentProfile.create({
            data: {
              userId: created.id,
              studentId,
              admissionDate: new Date(),
              admissionStatus: "active",
              status: "active",
            },
          });

          return created;
        });
      } else {
        newUser = await db.user.create({
          data: userData as Parameters<typeof db.user.create>[0]["data"],
          select: {
            id: true, email: true, name: true, phone: true, avatar: true,
            role: true, isActive: true, isSuperAdmin: true, createdAt: true,
            institutionId: true,
            institution: { select: { id: true, name: true, shortName: true } },
            roleRel: { select: { id: true, name: true, displayName: true } },
          },
        });
      }

      await createAuditLog({
        userId: user.userId,
        action: "create",
        resource: "user",
        resourceId: newUser.id,
        details: { email: newUser.email, name: newUser.name, role },
        ipAddress: ipFromRequest(request),
      });

      return NextResponse.json({ data: newUser }, { status: 201 });
    } catch (error) {
      console.error("Error creating user:", error);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }
  },
  { minRole: "admin" }
);
