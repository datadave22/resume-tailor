import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-layout";
import { 
  UserX,
  UserCheck,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  freeRevisionsUsed: number;
  paidRevisionsRemaining: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout activeNav="users">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground text-sm sm:text-base">View and manage all user accounts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>{users?.length || 0} registered users</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-muted/50"
                  data-testid={`user-row-${u.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm sm:text-base truncate">
                        {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                      </span>
                      {u.role === "admin" && (
                        <Badge variant="default">Admin</Badge>
                      )}
                      <Badge variant={u.status === "active" ? "secondary" : "destructive"}>
                        {u.status}
                      </Badge>
                    </div>
                    {u.firstName && u.lastName && (
                      <p className="text-xs text-muted-foreground truncate mb-1">{u.email}</p>
                    )}
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      <span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                      <span>Free: {u.freeRevisionsUsed}/3</span>
                      <span>Paid: {u.paidRevisionsRemaining}</span>
                      {u.lastLoginAt && (
                        <span className="hidden sm:inline">Last login: {new Date(u.lastLoginAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {u.role !== "admin" && (
                      u.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ userId: u.id, status: "deactivated" })}
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-deactivate-${u.id}`}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Deactivate</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ userId: u.id, status: "active" })}
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-activate-${u.id}`}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Activate</span>
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No users found.</p>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
