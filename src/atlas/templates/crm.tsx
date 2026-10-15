import { useState } from "react";
import {
  LayoutGrid,
  Users,
  Settings,
  Plus,
  List,
  MoreHorizontal,
  Target,
  Briefcase,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import type { TemplateProps, Entity } from "../types";
import { list, money, compactMoney, makeId } from "../types";
import {
  AppFrame,
  PageHead,
  Button,
  Stat,
  Panel,
  Search,
  Tabs,
  Avatar,
  Badge,
  FormModal,
  SettingPanel,
  Empty,
  useToast,
} from "../shared/ui";
const stages = [
  "Novo contato",
  "Em conversa",
  "Proposta",
  "Negociação",
  "Ganho",
];
export default function CRM({ config }: TemplateProps) {
  const [deals, setDeals] = useState(list(config, "deals")),
    [view, setView] = useState("pipeline"),
    [layout, setLayout] = useState("Quadro"),
    [query, setQuery] = useState(""),
    [edit, setEdit] = useState<Entity | null>(null),
    [creating, setCreating] = useState(false);
  const toast = useToast();
  const filtered = deals.filter((d) =>
    `${d.title} ${d.person}`.toLowerCase().includes(query.toLowerCase()),
  );
  const total = deals.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <AppFrame
      config={config}
      nav={[
        {
          id: "pipeline",
          label: "Pipeline de vendas",
          icon: <LayoutGrid size={18} />,
        },
        { id: "contacts", label: "Contatos", icon: <Users size={18} /> },
        { id: "settings", label: "Preferências", icon: <Settings size={18} /> },
      ]}
      active={view}
      onNav={setView}
    >
      <PageHead
        eyebrow="COMERCIAL / VISÃO GERAL"
        title={
          view === "contacts"
            ? "Boas relações começam aqui"
            : config.content.headline
        }
        description={config.content.description}
      >
        <Button
          onClick={() => {
            setEdit(null);
            setCreating(true);
          }}
        >
          <Plus size={17} />
          Nova oportunidade
        </Button>
      </PageHead>
      {view === "settings" ? (
        <SettingPanel />
      ) : (
        <>
          <div className="stat-grid">
            <Stat
              label="Pipeline total"
              value={compactMoney(total)}
              change={`${deals.length} oportunidades mapeadas`}
              icon={<Briefcase size={17} />}
            />
            <Stat
              label="Em negociação"
              value={compactMoney(
                deals
                  .filter((d) => d.status === "Negociação")
                  .reduce((s, d) => s + (d.value || 0), 0),
              )}
              change="Negócios na reta final"
              icon={<Target size={17} />}
            />
            <Stat
              label="Negócios ganhos"
              value={compactMoney(
                deals
                  .filter((d) => d.status === "Ganho")
                  .reduce((s, d) => s + (d.value || 0), 0),
              )}
              change="Etapa de venda concluída"
              icon={<CheckCircle2 size={17} />}
            />
            <Stat
              label="Novas conversas"
              value={deals.filter((d) => d.status === "Novo contato").length}
              change="Próximos passos esperando você"
              accent
            />
          </div>
          <div className="toolbar">
            <Tabs
              items={["Quadro", "Lista"]}
              value={layout}
              onChange={setLayout}
            />
            <Search
              value={query}
              onChange={setQuery}
              placeholder="Buscar oportunidade…"
            />
          </div>
          {view === "contacts" ? (
            <Panel title="Pessoas & oportunidades">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Contato</th>
                      <th>Oportunidade</th>
                      <th>Etapa</th>
                      <th>Valor</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div className="inline">
                            <Avatar name={d.person} />
                            <b>{d.person}</b>
                          </div>
                        </td>
                        <td>{d.title}</td>
                        <td>
                          <Badge>{d.status}</Badge>
                        </td>
                        <td>{money(d.value || 0)}</td>
                        <td>
                          <Button variant="ghost" onClick={() => setEdit(d)}>
                            Detalhes
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : layout === "Quadro" ? (
            <div className="kanban-scroll">
              <div className="kanban">
                {stages.map((s, i) => {
                  const col = filtered.filter((d) => d.status === s);
                  return (
                    <section className="kanban-column" key={s}>
                      <div className="kanban-head">
                        <span className={`stage-dot stage-${i}`} />
                        <h2>{s}</h2>
                        <span>{col.length}</span>
                      </div>
                      <p className="kanban-total">
                        {money(col.reduce((sum, d) => sum + (d.value || 0), 0))}
                      </p>
                      {col.map((d) => (
                        <button
                          className="deal-card"
                          key={d.id}
                          onClick={() => setEdit(d)}
                        >
                          <div className="between">
                            <Badge tone="accent">{d.category}</Badge>
                            <MoreHorizontal size={17} />
                          </div>
                          <h3>{d.title}</h3>
                          <strong>{money(d.value || 0)}</strong>
                          <div className="deal-person">
                            <Avatar name={d.person} size={25} />
                            <span>{d.person}</span>
                          </div>
                          <div className="deal-date">
                            Próximo contato <span>{d.date}</span>
                          </div>
                        </button>
                      ))}
                      <button
                        className="kanban-add"
                        onClick={() => {
                          setEdit({ id: "", title: "", status: s });
                          setCreating(true);
                        }}
                      >
                        <Plus size={15} />
                        Adicionar
                      </button>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <Panel>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Oportunidade</th>
                      <th>Contato</th>
                      <th>Valor</th>
                      <th>Etapa</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <b>{d.title}</b>
                          <span className="secondary">{d.category}</span>
                        </td>
                        <td>{d.person}</td>
                        <td>{money(d.value || 0)}</td>
                        <td>
                          <Badge>{d.status}</Badge>
                        </td>
                        <td>
                          <Button variant="ghost" onClick={() => setEdit(d)}>
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && <Empty />}
            </Panel>
          )}
        </>
      )}
      <FormModal
        open={creating || !!edit}
        onClose={() => {
          setCreating(false);
          setEdit(null);
        }}
        title={creating ? "Nova oportunidade" : "Detalhes da oportunidade"}
        fields={[
          { name: "title", label: "Nome do negócio", value: edit?.title },
          { name: "person", label: "Contato", value: edit?.person },
          {
            name: "value",
            label: "Valor (R$)",
            type: "number",
            min: 0,
            value: edit?.value,
          },
          {
            name: "category",
            label: "Categoria",
            value: edit?.category || "Serviços",
          },
          {
            name: "status",
            label: "Etapa do pipeline",
            type: "select",
            options: stages,
            value: edit?.status || stages[0],
          },
          {
            name: "date",
            label: "Próximo contato",
            value: edit?.date || "Hoje",
          },
        ]}
        onSubmit={(d) => {
          const deal = {
            ...d,
            id: edit?.id || makeId(),
            title: d.title,
            value: Number(d.value),
          };
          setDeals((prev) =>
            edit?.id
              ? prev.map((x) => (x.id === edit.id ? deal : x))
              : [...prev, deal],
          );
          toast("Oportunidade salva no pipeline.");
        }}
      />
    </AppFrame>
  );
}
