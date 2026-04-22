"use client"

import { useState, useEffect } from "react"
import { User } from "@/payload-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageAIAssistant } from '@/components/AIAssistant/PageAIAssistant'
import { AssignPackageToPost } from '@/components/PackageAssignment/AssignPackageToPost'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Settings, 
  Eye, 
  Edit3, 
  Plus, 
  Trash2, 
  DollarSign,
  Package,
  Users,
  Calendar,
  Star,
  Loader2
} from 'lucide-react'
import { useRevenueCat } from "@/providers/RevenueCat"
import { Purchases, type Package as RevenueCatPackage } from "@revenuecat/purchases-js"
import { 
  BASE_PACKAGE_TEMPLATES,
  getPackagesByCategory,
  createHostPackageConfig,
  getDisplayTitle,
  getDisplayDescription,
  getEffectiveMultiplier,
  getEffectiveFeatures,
  type HostPackageConfig,
  type BasePackageConfig,
  type PackageCategory
} from "@/lib/package-types"

interface Props {
  user: User
}

interface PackagePreview {
  duration: number
  baseRate: number
  effectiveRate: number
  savings: number
  total: number
}

export default function ManagePackagesPage({ postId, posts }: { postId: string; posts?: any[] }) {
  const { packages, loading, error, setPackages } = useHostPackages(postId);

  // Add or update a package
  const upsertPackage = async (template: any, updates: any = {}) => {
    const existing = packages.find(p => p.revenueCatId === template.revenueCatId);
    if (existing) {
      // Update
      const res = await fetch(`/api/packages/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const updated = await res.json();
      setPackages(pkgs => pkgs.map(p => p.id === updated.id ? updated : p));
    } else {
      // Create
      const res = await fetch(`/api/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: postId,
          name: template.defaultName,
          revenueCatId: template.revenueCatId,
          isEnabled: true,
          ...updates,
        }),
      });
      const created = await res.json();
      setPackages(pkgs => [...pkgs, created]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading packages...</span>
      </div>
    );
  }
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Manage Packages</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PACKAGE_TEMPLATES.map(template => {
          const pkg = packages.find(p => p.revenueCatId === template.revenueCatId);
          return (
            
            <Card key={template.revenueCatId}>
              <CardHeader>
                <CardTitle>{pkg?.name || template.defaultName}</CardTitle>
                <CardDescription>
                  RevenueCat Product: <span className="font-mono">{template.revenueCatId}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Display Name</label>
                  <Input
                    value={pkg?.name || template.defaultName}
                    onChange={e => upsertPackage(template, { name: e.target.value })}
                    disabled={!pkg}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`enabled-${template.revenueCatId}`}
                    checked={!!pkg?.isEnabled}
                    onCheckedChange={checked => upsertPackage(template, { isEnabled: checked })}
                    disabled={!pkg}
                  />
                  <label htmlFor={`enabled-${template.revenueCatId}`}>Enabled</label>
                </div>
              </CardContent>
              <CardFooter>
                {!pkg && (
                  <Button onClick={() => upsertPackage(template)}>
                    Add Package
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Package Assignment Assistant */}
      <div className="mt-12 border-t border-primary/20 pt-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Assign Package to Post</h2>
          <AssignPackageToPost
            postId={postId}
            posts={posts || []}
          />
        </div>
      </div>

      {/* General AI Assistant */}
      <div className="mt-12 border-t border-primary/20 pt-12">
        <div className="max-w-3xl mx-auto">
          <PageAIAssistant
            context={{
              type: 'manage',
              data: {
                posts: posts || [],
                postId,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

function useHostPackages(postId: string) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    fetch(`/api/packages?where[post][equals]=${postId}`)
      .then(res => res.json())
      .then(data => {
        setPackages(data.docs || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load packages');
        setLoading(false);
      });
  }, [postId]);

  return { packages, loading, error, setPackages };
}

const PACKAGE_TEMPLATES = [
  { revenueCatId: 'per_night_customer', defaultName: 'Per Night (Customer)' },
  { revenueCatId: 'weekly_customer', defaultName: 'Weekly (Customer)' },
  { revenueCatId: '3nights', defaultName: '🏄‍♂️ Stay 3-Nights' },
  { revenueCatId: 'per_night_luxury', defaultName: 'Per Night (Luxury)' },
  // ...add all your templates
]; 