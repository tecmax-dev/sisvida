import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export default function ModalLab() {
  const [outer, setOuter] = useState(true);
  const [inner, setInner] = useState(false);
  const [type, setType] = useState("");
  const [emp, setEmp] = useState("");
  const [pop, setPop] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setOuter(true)}>abrir</Button>
      <Dialog open={outer} onOpenChange={setOuter} modal>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-w-[95vw] w-[1200px] h-[90vh] p-0 flex flex-col"
        >
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 w-full">
              <div className="p-6">
                <Button data-testid="open-inner" onClick={() => setInner(true)}>Nova contribuição</Button>
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inner} onOpenChange={setInner}>
        <DialogContent className="sm:max-w-md">
          <Popover open={pop} onOpenChange={setPop}>
            <PopoverTrigger asChild>
              <Button data-testid="emp-trigger" variant="outline">{emp || "Procurar empresa"}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar empresa..." />
                <CommandList>
                  <CommandGroup>
                    <CommandItem data-testid="emp-item" onSelect={() => { setEmp("ACME"); setPop(false); }}>ACME</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="type-trigger"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem data-testid="type-item" value="mensalidade">Mensalidade</SelectItem>
            </SelectContent>
          </Select>
          <div data-testid="state">{`emp=${emp};type=${type}`}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
