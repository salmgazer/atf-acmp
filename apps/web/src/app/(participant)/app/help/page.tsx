"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  HelpCircle,
  MessageSquare,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

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

function HelpContent() {
  const router = useRouter();

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
                Can't find what you're looking for? Ask in the Technical Help chat.
              </p>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => router.push("/app/chat?channel=technical-help")}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Get Technical Help
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
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
