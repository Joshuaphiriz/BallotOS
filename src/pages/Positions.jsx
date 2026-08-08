import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { ListOrdered, GripVertical, Trash2, Plus } from 'lucide-react';
import PageHeader from '@/components/ems/PageHeader';
import EmptyState from '@/components/ems/EmptyState';
import Loader from '@/components/ems/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

export default function Positions() {
  const { election } = useOutletContext();
  const [positions, setPositions] = useState(null);
  const [title, setTitle] = useState('');
  const { toast } = useToast();

  const load = async () => {
    if (!election) return setPositions([]);
    setPositions(await base44.entities.Position.filter({ election_id: election.id }, 'order'));
  };
  useEffect(() => { load(); }, [election]);

  const add = async () => {
    if (!title.trim()) return;
    await base44.entities.Position.create({ election_id: election.id, title: title.trim(), order: positions.length });
    setTitle('');
    toast({ title: 'Position added' });
    load();
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const next = Array.from(positions);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setPositions(next);
    await base44.entities.Position.bulkUpdate(next.map((p, i) => ({ id: p.id, order: i })));
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete the position "${p.title}"? Candidates linked to it will remain unassigned.`)) return;
    await base44.entities.Position.delete(p.id);
    toast({ title: 'Position deleted' });
    load();
  };

  if (!election) return <p className="text-slate-500">Create an election first.</p>;
  if (!positions) return <Loader />;

  return (
    <div>
      <PageHeader title="Positions" subtitle="Drag to set the order candidates appear on the ballot" />
      <div className="flex gap-3 mb-6 max-w-xl">
        <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="e.g. President" className="rounded-xl h-11" />
        <Button onClick={add} className="rounded-xl h-11" style={{ background: 'var(--ems-primary)' }}><Plus className="h-4 w-4 mr-2" />Add</Button>
      </div>

      {positions.length === 0 ? (
        <EmptyState icon={ListOrdered} title="No positions yet" description="Add the offices being contested in this election." />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="positions">
            {(prov) => (
              <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-3 max-w-3xl">
                {positions.map((p, i) => (
                  <Draggable key={p.id} draggableId={p.id} index={i}>
                    {(dp, snap) => (
                      <div ref={dp.innerRef} {...dp.draggableProps}
                        className={`flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 ${snap.isDragging ? 'shadow-xl' : ''}`}>
                        <span {...dp.dragHandleProps} className="text-slate-400 cursor-grab"><GripVertical className="h-5 w-5" /></span>
                        <span className="h-8 w-8 rounded-lg grid place-items-center text-xs font-semibold text-white" style={{ background: 'var(--ems-primary)' }}>{i + 1}</span>
                        <p className="font-medium text-slate-900 dark:text-white flex-1">{p.title}</p>
                        <Button variant="ghost" size="icon" className="rounded-lg text-slate-400 hover:text-red-600" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {prov.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}