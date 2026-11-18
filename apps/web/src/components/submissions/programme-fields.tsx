"use client";
import { FormAnswers, ProgrammeField, PROGRAMME_OPTION_LABELS, fieldVisible, wordCount } from "@acmp/shared";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export function ProgrammeFields({ fields, answers, onChange, readOnly = false }: { fields: readonly ProgrammeField[]; answers: FormAnswers; onChange?: (value: FormAnswers) => void; readOnly?: boolean }) {
  const change = (name: string, value: unknown) => onChange?.({ ...answers, [name]: value });
  return <div className="space-y-8">{[...new Set(fields.map(field => field.section))].map(section => <section key={section} className="space-y-5 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{section}</h2>{fields.filter(field => field.section === section && fieldVisible(field, answers)).map(field => {
    const value = answers[field.name], id = `programme-${field.name}`, label = `${field.label}${field.optional ? " (optional)" : ""}`;
    if (readOnly) return <div key={field.name} className="space-y-1"><p className="text-sm font-medium text-muted-foreground">{field.label}</p>{Array.isArray(value) && ["milestones", "indicators"].includes(field.type || "") ? <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{value.map((row, index) => <tr key={index}>{Object.entries(row).map(([key, cell]) => <td key={key} className="border p-2">{String(cell)}</td>)}</tr>)}</tbody></table></div> : <p className="whitespace-pre-wrap break-words text-sm">{typeof value === "boolean" ? value ? "Yes" : "No" : Array.isArray(value) ? value.join(", ") : PROGRAMME_OPTION_LABELS[String(value)] || String(value ?? "—")}</p>}</div>;
    return <div key={field.name} className="space-y-2"><Label htmlFor={id}>{label}</Label>{field.help && <p className="text-sm text-muted-foreground">{field.help}</p>}
      {field.type === "checkbox" ? <div className="flex items-center gap-2"><Checkbox id={id} checked={value === true} onCheckedChange={checked => change(field.name, checked === true)} /><span className="text-sm">{value === true ? "Confirmed" : "Not confirmed"}</span></div>
      : field.type === "select" ? <select id={id} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={String(value || "")} onChange={event => change(field.name, event.target.value)}><option value="">Select an answer</option>{field.options?.map(option => <option key={option} value={option}>{PROGRAMME_OPTION_LABELS[option] || option}</option>)}</select>
      : field.type === "checks" ? <div className="grid gap-3 sm:grid-cols-2">{field.options?.map(option => <label key={option} className="flex items-center gap-2 text-sm"><Checkbox checked={Array.isArray(value) && value.includes(option)} onCheckedChange={checked => change(field.name, checked ? [...(Array.isArray(value) ? value.filter(item => item !== "None of these") : []), option].filter(item => option !== "None of these" || item === option) : Array.isArray(value) ? value.filter(item => item !== option) : [])} />{option}</label>)}</div>
      : field.type === "milestones" || field.type === "indicators" ? <ProgrammeRows name={field.name} type={field.type} value={Array.isArray(value) ? value : []} change={rows => change(field.name, rows)} />
      : field.type === "number" ? <Input id={id} type="number" min={0} max={field.name === "weeklyHours" ? 168 : 100000} value={typeof value === "number" ? value : ""} onChange={event => change(field.name, event.target.value === "" ? "" : Number(event.target.value))} />
      : field.type === "email" ? <Input id={id} type="email" maxLength={field.maxChars} value={String(value || "")} onChange={event => change(field.name, event.target.value)} />
      : <Textarea id={id} maxLength={field.maxChars} rows={field.words && field.words <= 30 ? 2 : 4} value={String(value || "")} onChange={event => change(field.name, event.target.value)} />}
      {field.words && <p className={`text-xs ${wordCount(value) > field.words ? "text-destructive" : "text-muted-foreground"}`}>{wordCount(value)} / {field.words} words</p>}
    </div>;
  })}</section>)}</div>;
}
function ProgrammeRows({ name, type, value, change }: { name: string; type: "milestones" | "indicators"; value: Array<Record<string, string>>; change: (value: Array<Record<string, string>>) => void }) {
  const columns = type === "milestones" ? ["milestone", "date"] : ["indicator", "measurement", "target"];
  const max = type === "milestones" ? 4 : 3;
  return <div className="space-y-3">{value.map((row, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">{columns.map(column => <div key={column}><Label htmlFor={`${name}-${index}-${column}`} className="capitalize">{column}</Label><Input id={`${name}-${index}-${column}`} type={column === "date" ? "date" : "text"} maxLength={500} value={row[column] || ""} onChange={event => change(value.map((item, i) => i === index ? { ...item, [column]: event.target.value } : item))} /></div>)}<Button type="button" variant="ghost" onClick={() => change(value.filter((_, i) => i !== index))}>Remove row {index + 1}</Button></div>)}<Button type="button" variant="outline" disabled={value.length >= max} onClick={() => change([...value, Object.fromEntries(columns.map(column => [column, ""]))])}>Add {type === "milestones" ? "milestone" : "indicator"}</Button></div>;
}
