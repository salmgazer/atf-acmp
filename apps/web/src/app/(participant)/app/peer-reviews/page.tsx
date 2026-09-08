"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, MessageSquare } from "lucide-react";
import { MyReviewsList, ReceivedReviewsList } from "@/components/peer-reviews";

export default function PeerReviewsPage() {
  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Peer Reviews</h1>
        <p className="text-muted-foreground">
          Review other teams and see feedback from your peers
        </p>
      </div>

      <Tabs defaultValue="assigned" className="space-y-6">
        <TabsList>
          <TabsTrigger value="assigned">
            <ClipboardList className="mr-2 h-4 w-4" />
            My Assignments
          </TabsTrigger>
          <TabsTrigger value="received">
            <MessageSquare className="mr-2 h-4 w-4" />
            Received Reviews
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assigned">
          <MyReviewsList />
        </TabsContent>

        <TabsContent value="received">
          <ReceivedReviewsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
