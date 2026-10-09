import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Eye, ShoppingCart, Loader2, Phone, MapPin, CreditCard, Package, MessageSquare, Trash2, Download, Save, Link as LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import LimitWarningBanner from "@/components/LimitWarningBanner";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  whatsapp_phone: string | null;
  district: string | null;
  customer_address: string | null;
  order_items: unknown;
  special_instructions: string | null;
  payment_method: string;
  status: string;
  total_amount: number;
  created_at: string;
  payment_slip_url: string | null;
  payment_status: string | null;
  delivery_status: string | null;
  follow_up_status: string | null;
  customer_notes: string | null;
}

const statusColors: Record<string, string> = {
  "New": "bg-blue-100 text-blue-800",
  "Confirmed": "bg-indigo-100 text-indigo-800",
  "Bank Transfer Pending": "bg-yellow-100 text-yellow-800",
  "Payment Slip Received": "bg-orange-100 text-orange-800",
  "Payment Confirmed": "bg-green-100 text-green-800",
  "Cash on Delivery Confirmed": "bg-teal-100 text-teal-800",
  "Processing": "bg-blue-200 text-blue-900",
  "Out for Delivery": "bg-purple-100 text-purple-800",
  "Delivered": "bg-green-200 text-green-900",
  "Completed": "bg-gray-100 text-gray-800",
  "Cancelled": "bg-red-100 text-red-800",
  // Fallbacks for older orders
  "pending": "bg-yellow-100 text-yellow-800",
  "processing": "bg-blue-100 text-blue-800",
  "shipped": "bg-purple-100 text-purple-800",
  "delivered": "bg-green-100 text-green-800",
  "cancelled": "bg-red-100 text-red-800",
};

const statusOptions = [
  { value: "New", label: "New" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Bank Transfer Pending", label: "Bank Transfer Pending" },
  { value: "Payment Slip Received", label: "Payment Slip Received" },
  { value: "Payment Confirmed", label: "Payment Confirmed" },
  { value: "Cash on Delivery Confirmed", label: "Cash on Delivery Confirmed" },
  { value: "Processing", label: "Processing" },
  { value: "Out for Delivery", label: "Out for Delivery" },
  { value: "Delivered", label: "Delivered" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // State for editable fields in details modal
  const [editFields, setEditFields] = useState<Partial<Order>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching orders",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
      toast({ title: "Order status updated" });
      fetchOrders();
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error: any) {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveOrderDetails = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: editFields.payment_status,
          delivery_status: editFields.delivery_status,
          follow_up_status: editFields.follow_up_status,
          customer_notes: editFields.customer_notes,
          payment_slip_url: editFields.payment_slip_url
        })
        .eq("id", selectedOrder.id);

      if (error) throw error;
      toast({ title: "Order details saved successfully" });
      
      const updatedOrder = { ...selectedOrder, ...editFields } as Order;
      setSelectedOrder(updatedOrder);
      
      // Update in the list
      setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    } catch (error: any) {
      toast({
        title: "Error saving details",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;
      toast({ title: "Order deleted" });
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
      fetchOrders();
    } catch (error: any) {
      toast({ title: "Error deleting order", description: error.message, variant: "destructive" });
    }
  };

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setEditFields({
      payment_status: order.payment_status || "",
      delivery_status: order.delivery_status || "",
      follow_up_status: order.follow_up_status || "",
      customer_notes: order.customer_notes || "",
      payment_slip_url: order.payment_slip_url || "",
    });
  };

  const exportOrders = (type: "csv" | "excel") => {
    if (orders.length === 0) {
      toast({ title: "No orders to export", variant: "destructive" });
      return;
    }

    const headers = [
      "Order ID", "Customer Name", "WhatsApp Number", "Normal Phone", 
      "District", "Address", "Items", "Payment Method", "Order Status", 
      "Payment Status", "Delivery Status", "Follow-Up Status", "Total (LKR)", 
      "Customer Notes", "Special Instructions", "Date"
    ];
    
    const rows = orders.map((o) => {
      const items = Array.isArray(o.order_items)
        ? (o.order_items as any[]).map((i: any) => {
            const vars = i.variations ? Object.entries(i.variations).map(([k,v]) => `${k}:${v}`).join(",") : "";
            return `${i.name}${vars ? ` (${vars})` : ""} x${i.quantity}`;
          }).join("; ")
        : "";
        
      return [
        o.id.slice(0, 8),
        o.customer_name,
        o.whatsapp_phone || "",
        o.customer_phone,
        o.district || "",
        o.customer_address || "",
        items,
        o.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer",
        o.status,
        o.payment_status || "",
        o.delivery_status || "",
        o.follow_up_status || "",
        o.total_amount.toFixed(2),
        o.customer_notes || "",
        o.special_instructions || "",
        format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: type === "excel"
        ? "application/vnd.ms-excel;charset=utf-8"
        : "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filterLabel = statusFilter === "all" ? "all" : statusFilter;
    a.download = `orders-${filterLabel}-${format(new Date(), "yyyy-MM-dd")}.${type === "excel" ? "xls" : "csv"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `Orders exported as ${type === "excel" ? "Excel" : "CSV"}` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <LimitWarningBanner type="orders" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Orders</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Manage customer orders from WhatsApp
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground hidden sm:inline">Filter:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => exportOrders("csv")} disabled={orders.length === 0}>
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportOrders("excel")} disabled={orders.length === 0}>
              <Download className="mr-1.5 h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order List</CardTitle>
            <CardDescription>
              {orders.length} order{orders.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {statusFilter === "all" 
                    ? "No orders yet. Orders will appear here when customers order via WhatsApp." 
                    : `No ${statusFilter} orders found.`}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile: Card layout */}
                <div className="space-y-3 md:hidden">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                        </div>
                        <Badge className={statusColors[order.status] || "bg-gray-100 text-gray-800"}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">LKR {order.total_amount.toFixed(2)}</span>
                        <span className="text-muted-foreground">{format(new Date(order.created_at), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openOrderModal(order)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Order</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete this order. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteOrder(order.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: Table layout */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.customer_name}</TableCell>
                          <TableCell>{order.whatsapp_phone || order.customer_phone}</TableCell>
                          <TableCell>LKR {order.total_amount.toFixed(2)}</TableCell>
                          <TableCell className="capitalize">
                            {order.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={order.status}
                              onValueChange={(value) => updateOrderStatus(order.id, value)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <Badge className={statusColors[order.status] || "bg-gray-100 text-gray-800"}>
                                  {order.status}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {format(new Date(order.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openOrderModal(order)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Order</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete this order. This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteOrder(order.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Order Details Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>
                Order #{selectedOrder?.id.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                
                {/* 1. Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 border-b pb-4">
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm text-muted-foreground">Customer Name</h4>
                    <p className="font-medium">{selectedOrder.customer_name}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> WhatsApp Number
                    </h4>
                    <p>{selectedOrder.whatsapp_phone || "Not provided"}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Normal Contact
                    </h4>
                    <p>{selectedOrder.customer_phone}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2 md:col-span-3">
                    <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Delivery Address
                    </h4>
                    <p>
                      {selectedOrder.customer_address 
                        ? `${selectedOrder.customer_address}${selectedOrder.district ? `, ${selectedOrder.district}` : ""}`
                        : "Not provided"}
                    </p>
                  </div>
                </div>

                {/* 2. Order Items */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> Selected Products
                  </h4>
                  <div className="border rounded-lg divide-y bg-muted/20">
                    {(Array.isArray(selectedOrder.order_items) ? selectedOrder.order_items : []).map((item: any, index: number) => (
                      <div key={index} className="p-3 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.variations && (
                            <p className="text-sm text-muted-foreground">
                              {Object.entries(item.variations).map(([key, value]) => `${key}: ${value}`).join(" | ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">LKR {item.price}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 flex justify-between items-center bg-muted/40 font-bold border-t-2">
                      <p>Total Order Value</p>
                      <p className="text-lg text-primary">LKR {selectedOrder.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* 3. Tracking & Finance Info (Editable) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> Payment Method
                      </h4>
                      <p className="font-medium capitalize text-lg">
                        {selectedOrder.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer"}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm text-muted-foreground">Payment Status</h4>
                      <Input 
                        value={editFields.payment_status || ""} 
                        onChange={(e) => setEditFields({...editFields, payment_status: e.target.value})}
                        placeholder="e.g., Pending, Received, Confirmed"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" /> Payment Slip URL
                      </h4>
                      <Input 
                        value={editFields.payment_slip_url || ""} 
                        onChange={(e) => setEditFields({...editFields, payment_slip_url: e.target.value})}
                        placeholder="https://link-to-slip.com/img.jpg"
                      />
                      {editFields.payment_slip_url && (
                        <a href={editFields.payment_slip_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                          View Payment Slip
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm text-muted-foreground">Order Status (Main)</h4>
                      <Select
                        value={selectedOrder.status}
                        onValueChange={(value) => updateOrderStatus(selectedOrder.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-medium text-sm text-muted-foreground">Delivery Status</h4>
                      <Input 
                        value={editFields.delivery_status || ""} 
                        onChange={(e) => setEditFields({...editFields, delivery_status: e.target.value})}
                        placeholder="e.g., Unfulfilled, Out for Delivery, Delivered"
                      />
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-medium text-sm text-muted-foreground">Follow-Up Status</h4>
                      <Input 
                        value={editFields.follow_up_status || ""} 
                        onChange={(e) => setEditFields({...editFields, follow_up_status: e.target.value})}
                        placeholder="e.g., Contacted on Oct 12, Need to call back"
                      />
                    </div>
                  </div>
                </div>
                
                {/* 4. Notes */}
                <div className="space-y-2 border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Customer Notes</h4>
                  <Textarea 
                    value={editFields.customer_notes || ""} 
                    onChange={(e) => setEditFields({...editFields, customer_notes: e.target.value})}
                    placeholder="Add internal notes about this customer or order..."
                    className="min-h-[80px]"
                  />
                </div>

                {/* Footer actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-6">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const chatPhone = selectedOrder.whatsapp_phone || selectedOrder.customer_phone;
                        setSelectedOrder(null);
                        navigate(`/dashboard/conversations?phone=${encodeURIComponent(chatPhone)}`);
                      }}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Chat History
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Placed: {format(new Date(selectedOrder.created_at), "PPp")}
                    </p>
                    <Button onClick={saveOrderDetails} disabled={isSaving} className="w-full sm:w-auto">
                      {isSaving ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Details
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
