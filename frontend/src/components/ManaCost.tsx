import { v4 } from 'uuid';

interface ManaCostProps {
  manaCost: string;
}

const ManaCost = (props: ManaCostProps) => {
  const manaSymbols = props.manaCost.split(/{|}/).filter((symbol) => symbol.length > 0);
  return (
    <div>
      {manaSymbols.map((symbol) => (
        <i
        className={`ms ms-${symbol.toLowerCase()} ms-cost ms-shadow`}
        key={`${symbol}-${v4()}`}
        / >
      ))}
    </div>
  );
}

export default ManaCost;
