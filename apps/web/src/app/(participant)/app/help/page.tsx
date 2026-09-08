"use client";

import { useState } from "react";
import Link from "next/link";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HelpCircle,
  MessageSquare,
  Mail,
  FileText,
  Users,
  Calendar,
  Trophy,
  ArrowLeft,
  Send,
  Loader2,
  ExternalLink,
  BookOpen,
  Video,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

// FAQ data
const FAQ_ITEMS = [
  {
    category: "Getting Started",
    items: [
      {
        question: "How do I complete my profile?",
        answer: "After logging in, you'll be guided through an onboarding process to complete your profile. You can also update your profile anytime by going to Profile > Edit Profile. Make sure to add your skills and interests to help with team matching.",
      },
      {
        question: "How do I join or create a team?",
        answer: "Go to the Team section from the bottom navigation. You can either create a new team and invite others, or browse available teams and request to join. Teams must have 3-5 members from participating countries.",
      },
      {
        question: "What is a Brief?",
        answer: "A Brief is a problem statement provided by partner organizations. Your team will select a brief to work on and develop an AI solution for it. Browse available briefs in the Briefs section.",
      },
    ],
  },
  {
    category: "Teams & Collaboration",
    items: [
      {
        question: "Can I be on multiple teams?",
        answer: "No, each participant can only be a member of one team at a time. Choose your team carefully based on skills compatibility and shared interests.",
      },
      {
        question: "How do I communicate with my team?",
        answer: "Use the built-in Chat feature to communicate with your team members. You can also share files, discuss ideas, and coordinate your work through the chat.",
      },
      {
        question: "What happens if a team member leaves?",
        answer: "If a team member leaves, the team leader can invite a new member to replace them (if within the team formation deadline). Contact support if you face issues.",
      },
    ],
  },
  {
    category: "Submissions & Deadlines",
    items: [
      {
        question: "How do I submit my work?",
        answer: "Go to the Submissions section from your dashboard. Upload your files, add descriptions, and submit before the deadline. You can save drafts and update until the final submission.",
      },
      {
        question: "What file formats are accepted?",
        answer: "We accept PDF for documents, common image formats (PNG, JPG), and video links (YouTube, Vimeo). Check each stage requirements for specific format guidelines.",
      },
      {
        question: "Can I edit my submission after submitting?",
        answer: "Yes, you can update your submission until the deadline. After the deadline passes, no further edits are allowed.",
      },
    ],
  },
  {
    category: "Evaluation & Results",
    items: [
      {
        question: "How is my team evaluated?",
        answer: "Teams are evaluated based on the rubric criteria for each stage. This includes innovation, technical feasibility, impact potential, and presentation quality. Scores are released after the evaluation period.",
      },
      {
        question: "Where can I see my scores?",
        answer: "Once evaluations are complete, you can view your scores and feedback in the Submissions section. The leaderboard shows overall rankings.",
      },
      {
        question: "What happens if we advance to the next stage?",
        answer: "Congratulations! You'll receive a notification and can proceed to submit for the next stage. Check the deadlines and requirements for each stage.",
      },
    ],
  },
];

// Quick links
const QUICK_LINKS = [
  {
    icon: BookOpen,
    title: "Participant Guide",
    description: "Complete guide for participants",
    href: "#",
  },
  {
    icon: Video,
    title: "Video Tutorials",
    description: "Step-by-step video guides",
    href: "#",
  },
  {
    icon: Calendar,
    title: "Challenge Timeline",
    description: "Key dates and deadlines",
    href: "/app/dashboard",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    description: "View current rankings",
    href: "/app/leaderboard",
  },
];

function HelpContent() {
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactForm, setContactForm] = useState({
    category: "",
    subject: "",
    message: "",
  });

  const handleSubmitContact = async () => {
    if (!contactForm.category || !contactForm.subject || !contactForm.message) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    toast.success("Your message has been sent. We'll respond within 24-48 hours.");
    setShowContactDialog(false);
    setContactForm({ category: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/app/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Help & Support</h1>
          <p className="text-sm text-muted-foreground">Find answers and get help</p>
        </div>
      </div>

      {/* Contact Support Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Need more help?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Can't find what you're looking for? Contact our support team.
              </p>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => setShowContactDialog(true)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <link.icon className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{link.title}</p>
                  <p className="text-xs text-muted-foreground">{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {FAQ_ITEMS.map((category) => (
            <div key={category.category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {category.category}
              </h3>
              <Accordion type="single" collapsible className="w-full">
                {category.items.map((item, index) => (
                  <AccordionItem key={index} value={`${category.category}-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Email Support</p>
              <a
                href="mailto:support@atfchallenge.org"
                className="text-sm text-primary hover:underline"
              >
                support@atfchallenge.org
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Response Time</p>
              <p className="text-sm text-muted-foreground">
                We typically respond within 24-48 hours
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Support Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>
              Send us a message and we'll get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={contactForm.category}
                onValueChange={(value) =>
                  setContactForm((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Account & Login</SelectItem>
                  <SelectItem value="team">Teams & Collaboration</SelectItem>
                  <SelectItem value="submission">Submissions</SelectItem>
                  <SelectItem value="technical">Technical Issues</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief description of your issue"
                value={contactForm.subject}
                onChange={(e) =>
                  setContactForm((prev) => ({ ...prev, subject: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your issue in detail..."
                rows={4}
                value={contactForm.message}
                onChange={(e) =>
                  setContactForm((prev) => ({ ...prev, message: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowContactDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitContact} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function HelpPage() {
  return (
    <ProtectedRoute portal="participant">
      <ParticipantLayout>
        <HelpContent />
      </ParticipantLayout>
    </ProtectedRoute>
  );
}
