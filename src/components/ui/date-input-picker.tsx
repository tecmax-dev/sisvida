import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateInputPickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  fromYear?: number;
  toYear?: number;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

function maskDate(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  let out = digits;
  if (digits.length > 4) {
    out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  } else if (digits.length > 2) {
    out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return out;
}

export function DateInputPicker({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled,
  fromYear = 1950,
  toYear = new Date().getFullYear() + 10,
  minDate,
  maxDate,
  className,
  id,
  autoFocus,
}: DateInputPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string>(value ? format(value, "dd/MM/yyyy") : "");
  const [error, setError] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState<Date>(value ?? new Date());

  // Sync external value -> input text & calendar month
  React.useEffect(() => {
    if (value && isValid(value)) {
      const formatted = format(value, "dd/MM/yyyy");
      setText((prev) => (prev === formatted ? prev : formatted));
      setMonth(value);
      setError(null);
    } else if (!value) {
      setText("");
    }
  }, [value]);

  const isInRange = (d: Date) => {
    if (minDate && d < minDate) return false;
    if (maxDate && d > maxDate) return false;
    return true;
  };

  const tryParse = (raw: string): Date | null => {
    if (raw.length !== 10) return null;
    const parsed = parse(raw, "dd/MM/yyyy", new Date());
    if (!isValid(parsed)) return null;
    if (!isInRange(parsed)) return null;
    return parsed;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDate(e.target.value);
    setText(masked);

    if (masked.length === 0) {
      setError(null);
      onChange(undefined);
      return;
    }

    if (masked.length === 10) {
      const parsed = tryParse(masked);
      if (parsed) {
        setError(null);
        setMonth(parsed);
        onChange(parsed);
      } else {
        setError("Data inválida");
      }
    } else {
      setError(null);
    }
  };

  const handleBlur = () => {
    if (text && text.length > 0 && text.length < 10) {
      setError("Data inválida");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const parsed = tryParse(text);
      if (parsed) {
        setError(null);
        onChange(parsed);
        setOpen(false);
      } else if (text.length > 0) {
        setError("Data inválida");
      }
    }
  };

  const handleSelect = (d: Date | undefined) => {
    if (!d) {
      onChange(undefined);
      setText("");
      return;
    }
    setError(null);
    setText(format(d, "dd/MM/yyyy"));
    setMonth(d);
    onChange(d);
    setOpen(false);
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Input
          id={id}
          value={text}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode="numeric"
          maxLength={10}
          aria-invalid={!!error}
          className={cn("pr-10", error && "border-destructive focus-visible:ring-destructive")}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
              aria-label="Abrir calendário"
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              month={month}
              onMonthChange={setMonth}
              locale={ptBR}
              captionLayout="dropdown-buttons"
              fromYear={fromYear}
              toYear={toYear}
              fromDate={minDate}
              toDate={maxDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
