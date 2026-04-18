function normalizeBlocks(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === "object") return [value];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (!parsed) return [];
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  return [];
}

function renderCell(cell) {
  if (cell === null || cell === undefined) return "";

  if (typeof cell === "string" || typeof cell === "number") {
    return cell;
  }

  if (typeof cell === "object") {
    if (cell.title || cell.text || cell.content) {
      return (
        <div>
          {cell.title && <div className="font-medium">{cell.title}</div>}
          {cell.text && <div className="text-sm">{cell.text}</div>}
          {cell.content && <div className="text-sm">{cell.content}</div>}
        </div>
      );
    }

    return JSON.stringify(cell);
  }

  return String(cell);
}

export default function ResearchBlocks({ blocks }) {
  const blockList = normalizeBlocks(blocks);

  if (!blockList.length) return null;

  return (
    <div className="space-y-8">
      {blockList.map((block, i) => {
        if (!block || typeof block !== "object") return null;

        if (block.type === "table") {
          return (
            <div key={`${block.type}-${i}`} className="overflow-x-auto">
              {block.title && (
                <h3 className="text-xl font-semibold mb-4 text-[#A6192E]">
                  {block.title}
                </h3>
              )}

              <table className="w-full border text-sm">
                <thead className="bg-[#8B0000] text-white">
                  <tr>
                    {(block.columns || []).map((col, idx) => (
                      <th key={idx} className="p-3 text-left border border-white/20">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(block.rows || []).map((row, rIdx) => (
                    <tr key={rIdx} className="border-t">
                      {(row || []).map((cell, cIdx) => (
                        <td key={cIdx} className="p-3 align-top">
                          {renderCell(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "text") {
          return (
            <div key={`${block.type}-${i}`}>
              {block.title && (
                <h3 className="text-xl font-semibold mb-3 text-[#A6192E]">
                  {block.title}
                </h3>
              )}
              <p className="text-gray-800 leading-7 whitespace-pre-line">
                {block.content || ""}
              </p>
            </div>
          );
        }

        if (block.type === "image") {
          return (
            <div key={`${block.type}-${i}`}>
              {block.title && (
                <h3 className="text-xl font-semibold mb-3 text-[#A6192E]">
                  {block.title}
                </h3>
              )}
              {block.src && (
                <img
                  src={block.src}
                  alt={block.alt || block.title || "research"}
                  className="w-full max-w-4xl rounded-lg shadow-sm mb-3"
                />
              )}
              {block.caption && (
                <p className="text-sm text-gray-600">{block.caption}</p>
              )}
            </div>
          );
        }

        if (block.type === "accordion") {
          return (
            <div key={`${block.type}-${i}`} className="border rounded-lg">
              <details>
                <summary className="cursor-pointer list-none p-4 font-semibold text-[#A6192E] bg-gray-50">
                  {block.title || "Details"}
                </summary>
                <div className="p-4 border-t">
                  {block.content && (
                    <p className="text-gray-800 whitespace-pre-line leading-7">
                      {block.content}
                    </p>
                  )}

                  {Array.isArray(block.items) && block.items.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {block.items.map((item, idx) => (
                        <div key={idx} className="border rounded-md p-3">
                          {item.heading && (
                            <div className="font-semibold mb-1">{item.heading}</div>
                          )}
                          {item.text && (
                            <div className="text-sm text-gray-700 whitespace-pre-line">
                              {item.text}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </div>
          );
        }

        if (block.type === "card_grid") {
          return (
            <div key={`${block.type}-${i}`}>
              {block.title && (
                <h3 className="text-xl font-semibold mb-4 text-[#A6192E]">
                  {block.title}
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(block.items || []).map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-4 shadow-sm">
                    {item.title && (
                      <div className="font-semibold mb-2">{item.title}</div>
                    )}
                    {item.text && (
                      <div className="text-sm text-gray-700 whitespace-pre-line">
                        {item.text}
                      </div>
                    )}
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-3 text-[#A6192E] text-sm font-medium"
                      >
                        Read more
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}