// import { useState } from "react";

// const emptySection = {
//   title: "",
//   type: "list",
//   items: [""],
// };

// const ProfileSectionBuilder = ({ sections, setSections }) => {

//   const addSection = () => {
//     setSections([...sections, { ...emptySection }]);
//   };

//   const updateSection = (index, field, value) => {
//     const updated = [...sections];
//     updated[index][field] = value;
//     setSections(updated);
//   };

//   const updateItem = (secIdx, itemIdx, value) => {
//     const updated = [...sections];
//     updated[secIdx].items[itemIdx] = value;
//     setSections(updated);
//   };

//   const addItem = (secIdx) => {
//     const updated = [...sections];
//     updated[secIdx].items.push("");
//     setSections(updated);
//   };

//   const removeSection = (index) => {
//     setSections(sections.filter((_, i) => i !== index));
//   };

//   return (
//     <div className="space-y-6">
//       <h3 className="text-lg font-semibold">Profile Sections Builder</h3>

//       {sections.map((section, i) => (
//         <div key={i} className="border p-4 rounded space-y-3">

//           <input
//             placeholder="Section Title"
//             value={section.title}
//             onChange={(e) => updateSection(i, "title", e.target.value)}
//             className="w-full border p-2 rounded"
//           />

//           <select
//             value={section.type}
//             onChange={(e) => updateSection(i, "type", e.target.value)}
//             className="w-full border p-2 rounded"
//           >
//             <option value="list">List</option>
//             <option value="table">Table</option>
//             <option value="text">Text</option>
//           </select>

//           {/* LIST TYPE */}
//           {section.type === "list" &&
//             section.items.map((item, j) => (
//               <input
//                 key={j}
//                 value={item}
//                 onChange={(e) => updateItem(i, j, e.target.value)}
//                 placeholder="Item"
//                 className="w-full border p-2 rounded"
//               />
//             ))}

//           {section.type === "list" && (
//             <button
//               type="button"
//               onClick={() => addItem(i)}
//               className="text-blue-600 text-sm"
//             >
//               + Add Item
//             </button>
//           )}

//           <button
//             type="button"
//             onClick={() => removeSection(i)}
//             className="text-red-600 text-sm"
//           >
//             Remove Section
//           </button>
//         </div>
//       ))}

//       <button
//         type="button"
//         onClick={addSection}
//         className="bg-green-600 text-white px-3 py-1 rounded"
//       >
//         + Add Section
//       </button>
//     </div>
//   );
// };

// export default ProfileSectionBuilder;