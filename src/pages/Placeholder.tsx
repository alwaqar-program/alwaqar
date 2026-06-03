interface Props {
  title: string;
}
export default function Placeholder({ title }: Props) {
  return (
    <div className="p-8">
      <h2 className="text-3xl font-display font-bold text-slate-900">{title}</h2>
      <p className="text-slate-600 mt-2">قسم قيد التطوير.</p>
    </div>
  );
}
