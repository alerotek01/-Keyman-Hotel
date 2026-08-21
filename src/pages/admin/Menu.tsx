import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMenuCategories, useCreateMenuCategory, useUpdateMenuCategory, useDeleteMenuCategory } from '@/hooks/useMenu';
import { useMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem } from '@/hooks/useMenu';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, UtensilsCrossed, FolderOpen } from 'lucide-react';

export default function AdminMenu() {
  const { data: categories, isLoading: catsLoading } = useMenuCategories();
  const { data: items, isLoading: itemsLoading } = useMenuItems();
  const createCategory = useCreateMenuCategory();
  const updateCategory = useUpdateMenuCategory();
  const deleteCategory = useDeleteMenuCategory();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const { toast } = useToast();

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [catForm, setCatForm] = useState({ name: '', sort_order: '0' });

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    is_available: true,
  });

  const isLoading = catsLoading || itemsLoading;

  // ===== Category handlers =====
  const resetCatForm = () => { setCatForm({ name: '', sort_order: '0' }); setEditingCat(null); };

  const openCatCreate = () => { resetCatForm(); setCatDialogOpen(true); };
  const openCatEdit = (cat: any) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, sort_order: cat.sort_order?.toString() || '0' });
    setCatDialogOpen(true);
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCat) {
        await updateCategory.mutateAsync({ id: editingCat.id, name: catForm.name, sort_order: parseInt(catForm.sort_order) });
        toast({ title: 'Category Updated' });
      } else {
        await createCategory.mutateAsync({ name: catForm.name, sort_order: parseInt(catForm.sort_order) });
        toast({ title: 'Category Created' });
      }
      setCatDialogOpen(false);
      resetCatForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCatDelete = async (cat: any) => {
    const itemCount = items?.filter(i => i.category_id === cat.id).length || 0;
    if (itemCount > 0) {
      toast({ title: 'Cannot Delete', description: `Remove ${itemCount} item(s) from this category first.`, variant: 'destructive' });
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await deleteCategory.mutateAsync(cat.id);
      toast({ title: 'Category Deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // ===== Item handlers =====
  const resetItemForm = () => {
    setItemForm({ name: '', description: '', price: '', category_id: '', is_available: true });
    setEditingItem(null);
  };

  const openItemCreate = () => { resetItemForm(); setItemDialogOpen(true); };
  const openItemEdit = (item: any) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category_id: item.category_id,
      is_available: item.is_available,
    });
    setItemDialogOpen(true);
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: itemForm.name,
        description: itemForm.description || undefined,
        price: parseFloat(itemForm.price),
        category_id: itemForm.category_id,
        is_available: itemForm.is_available,
      };
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...payload });
        toast({ title: 'Item Updated' });
      } else {
        await createItem.mutateAsync(payload);
        toast({ title: 'Item Created' });
      }
      setItemDialogOpen(false);
      resetItemForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleItemDelete = async (item: any) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteItem.mutateAsync(item.id);
      toast({ title: 'Item Deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleItemToggle = async (item: any) => {
    try {
      await updateItem.mutateAsync({ id: item.id, is_available: !item.is_available });
      toast({ title: item.is_available ? 'Item Disabled' : 'Item Enabled' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-brass" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Menu Management</h1>
        <p className="text-muted-foreground">Manage cafeteria menu categories and items</p>
      </div>

      <Tabs defaultValue="items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="items" className="gap-2"><UtensilsCrossed className="h-4 w-4" /> Menu Items</TabsTrigger>
          <TabsTrigger value="categories" className="gap-2"><FolderOpen className="h-4 w-4" /> Categories</TabsTrigger>
        </TabsList>

        {/* ===== ITEMS TAB ===== */}
        <TabsContent value="items" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brass" onClick={openItemCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingItem ? `Edit ${editingItem.name}` : 'New Menu Item'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleItemSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Price (KES)</Label>
                      <Input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={itemForm.category_id} onValueChange={(v) => setItemForm({ ...itemForm, category_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {categories?.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" variant="brass" className="w-full" disabled={createItem.isPending || updateItem.isPending}>
                    {(createItem.isPending || updateItem.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingItem ? 'Update Item' : 'Create Item'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {categories?.map(cat => {
            const catItems = items?.filter(i => i.category_id === cat.id) || [];
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id}>
                <h3 className="text-lg font-semibold mb-3">{cat.name}</h3>
                <div className="grid gap-3">
                  {catItems.map(item => (
                    <Card key={item.id} className={!item.is_available ? 'opacity-50' : ''}>
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{item.name}</h4>
                            {!item.is_available && <Badge variant="secondary">Unavailable</Badge>}
                          </div>
                          {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{formatCurrency(item.price)}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleItemToggle(item)}>
                            {item.is_available ? 'Disable' : 'Enable'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openItemEdit(item)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleItemDelete(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {(!items || items.length === 0) && (
            <div className="text-center py-12">
              <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No menu items yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create categories first, then add items</p>
            </div>
          )}
        </TabsContent>

        {/* ===== CATEGORIES TAB ===== */}
        <TabsContent value="categories" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brass" onClick={openCatCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Add Category
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{editingCat ? 'Edit Category' : 'New Category'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCatSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Breakfast, Lunch, Drinks" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Sort Order</Label>
                    <Input type="number" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })} />
                  </div>
                  <Button type="submit" variant="brass" className="w-full" disabled={createCategory.isPending || updateCategory.isPending}>
                    {(createCategory.isPending || updateCategory.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingCat ? 'Update' : 'Create'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3">
            {categories?.map(cat => {
              const count = items?.filter(i => i.category_id === cat.id).length || 0;
              return (
                <Card key={cat.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <h4 className="font-medium">{cat.name}</h4>
                      <p className="text-sm text-muted-foreground">{count} item{count !== 1 ? 's' : ''} • Order: {cat.sort_order || 0}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openCatEdit(cat)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleCatDelete(cat)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {(!categories || categories.length === 0) && (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No categories yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
