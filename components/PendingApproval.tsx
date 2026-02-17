'use client';

import { useAuth } from '@/lib/authContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Mail, Waves, LogOut } from 'lucide-react';

/**
 * Shown to operator-role users whose account status is 'pending'.
 * They've created an account but an admin hasn't approved + bound their jurisdiction yet.
 */
export function PendingApproval() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 shadow-sm">
            <Waves className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>PEARL</div>
            <div className="text-[9px] font-medium text-slate-400 -mt-1 tracking-widest uppercase">Water Quality Intelligence</div>
          </div>
        </div>

        <Card className="border-2 border-amber-200 bg-amber-50/30">
          <CardContent className="pt-8 text-center space-y-5">
            {/* Icon */}
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mx-auto">
              <Clock className="h-10 w-10 text-amber-600" />
            </div>

            <h2 className="text-xl font-bold text-slate-900">Access Request Pending</h2>

            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Your <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] mx-1">{user.role}</Badge> account
                has been submitted and is awaiting administrator approval.
              </p>
              <p>
                An admin will verify your organization and bind your jurisdiction,
                then you'll receive access to the full compliance dashboard.
              </p>
            </div>

            {/* Account info */}
            <div className="p-4 rounded-xl bg-white border border-amber-200 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Name</span>
                <span className="font-medium text-slate-700">{user.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-700">{user.email}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Role</span>
                <span className="font-medium text-slate-700">{user.role}</span>
              </div>
              {user.organization && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Organization</span>
                  <span className="font-medium text-slate-700">{user.organization}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Requested</span>
                <span className="font-medium text-slate-700">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Typically 1-2 business days. Questions? Contact{' '}
              <a href="mailto:doug@project-pearl.org" className="text-cyan-600 hover:text-cyan-700 underline">
                doug@project-pearl.org
              </a>
            </p>

            {/* Actions */}
            <div className="flex gap-3 justify-center pt-2">
              <a
                href="mailto:doug@project-pearl.org?subject=PEARL Access Request Status — {user.name}"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-cyan-700 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                Contact Admin
              </a>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
