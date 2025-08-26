import React, { useRef, useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import './TextEditor.css';

//  Input component for BBCode mentions with autocomplete
const MentionInput = ({ type, data, onSelect, onClose, buttonRef }) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [coords, setCoords] = useState({ x: '', y: '' });
    const popupRef = useRef(null);
    const inputRef = useRef(null);

    //  Position the popup relative to the button that opened it
    const popupStyle = () => {
        if (!buttonRef) return {};
        const rect = buttonRef.getBoundingClientRect();
        return {
            top: `${rect.bottom + window.scrollY + 5}px`,
            left: `${rect.left + window.scrollX}px`,
        };
    };

    //  Filter suggestions based on user input for players, cities, and alliances
    useEffect(() => {
        if (type === 'player' || type === 'city' || type === 'alliance') {
            if (inputValue.length > 0) {
                const filtered = data.filter(item => item.name.toLowerCase().startsWith(inputValue.toLowerCase()));
                setSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
            } else {
                setSuggestions([]);
            }
        }
    }, [inputValue, data, type]);

    //  Focus the input field when the popup opens
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    //  Close the popup if the user clicks outside of it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popupRef.current && !popupRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleSubmit = (value) => {
        if (type === 'island') {
            if (coords.x && coords.y) {
                onSelect(coords);
            }
        } else if (value) {
            onSelect(value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (type === 'island') {
                handleSubmit(coords);
            } else {
                let itemToSubmit = null;
                if (suggestions.length > 0) {
                    itemToSubmit = suggestions[0];
                } else {
                    itemToSubmit = data.find(item => item.name.toLowerCase() === inputValue.toLowerCase());
                }
    
                if (itemToSubmit) {
                    handleSubmit(itemToSubmit);
                }
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (type === 'island') {
        return (
            <div ref={popupRef} className="mention-input-popup" style={popupStyle()}>
                <input
                    ref={inputRef}
                    type="number"
                    value={coords.x}
                    onChange={(e) => setCoords(c => ({ ...c, x: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    placeholder="X coordinate"
                    className="mention-input"
                />
                <input
                    type="number"
                    value={coords.y}
                    onChange={(e) => setCoords(c => ({ ...c, y: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    placeholder="Y coordinate"
                    className="mention-input mt-1"
                />
            </div>
        );
    }

    return (
        <div ref={popupRef} className="mention-input-popup" style={popupStyle()}>
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Enter ${type} name...`}
                className="mention-input"
            />
            {(type === 'player' || type === 'city' || type === 'alliance') && suggestions.length > 0 && (
                <ul className="mention-suggestions">
                    {suggestions.map(item => (
                        <li key={item.id} onClick={() => handleSubmit(item)}>
                            {item.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

//  Cache for editor autocomplete data to reduce reads.
const editorDataCache = {
    players: null,
    cities: null,
    alliances: null,
    timestamp: 0,
};


//  The main text editor component
const TextEditor = ({ value, onChange }) => {
    const { worldId } = useGame();
    const textareaRef = useRef(null);
    const [showColors, setShowColors] = useState(false);
    const [mentionState, setMentionState] = useState({ visible: false, type: null, buttonRef: null });

    const [players, setPlayers] = useState([]);
    const [cities, setCities] = useState([]);
    const [alliances, setAlliances] = useState([]);

    //  Fetch players, cities, and alliances for autocomplete, using a cache.
    useEffect(() => {
        if (!worldId) return;

        const fetchData = async () => {
            const now = Date.now();
            const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

            if (now - editorDataCache.timestamp < CACHE_DURATION && editorDataCache.players) {
                setPlayers(editorDataCache.players);
                setCities(editorDataCache.cities);
                setAlliances(editorDataCache.alliances);
                return;
            }

            // Fetch all data in parallel if cache is stale
            const usersRef = collection(db, 'users');
            const citiesRef = collection(db, 'worlds', worldId, 'citySlots');
            const alliancesRef = collection(db, 'worlds', worldId, 'alliances');

            const playersQuery = getDocs(usersRef);
            const citiesQuery = getDocs(query(citiesRef, where("ownerId", "!=", null)));
            const alliancesQuery = getDocs(alliancesRef);

            const [playersSnapshot, citiesSnapshot, alliancesSnapshot] = await Promise.all([
                playersQuery,
                citiesQuery,
                alliancesQuery
            ]);

            const playersData = playersSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().username }));
            const citiesData = citiesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().cityName, ownerId: doc.data().ownerId, x: doc.data().x, y: doc.data().y }));
            const alliancesData = alliancesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, tag: doc.data().tag }));

            setPlayers(playersData);
            setCities(citiesData);
            setAlliances(alliancesData);

            // Update cache
            editorDataCache.players = playersData;
            editorDataCache.cities = citiesData;
            editorDataCache.alliances = alliancesData;
            editorDataCache.timestamp = now;
        };

        fetchData();
    }, [worldId]);

    const applyFormat = (tag, param = '') => {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        let selectedText = value.substring(start, end);
        
        let openTag = `[${tag}`;
        let content = selectedText;

        if (typeof param === 'object' && param !== null) {
            // For complex tags like player, city, alliance
            if (param.id) openTag += ` id=${param.id}`;
            if (param.ownerId) openTag += ` owner=${param.ownerId}`;
            if (param.x) openTag += ` x=${param.x}`;
            if (param.y) openTag += ` y=${param.y}`;
            openTag += ']';
            if (!content) content = param.name;
        } else if (param) {
            // For simple tags with a parameter like color, size, url
            if (tag === 'url') {
                openTag += `=${selectedText}]`;
                content = param; // The param becomes the display text
            } else {
                openTag += `=${param}]`;
            }
        } else {
            // For simple tags without parameters like b, i, u
            openTag += ']';
        }

        const closeTag = `[/${tag}]`;
        const newText = `${value.substring(0, start)}${openTag}${content}${closeTag}${value.substring(end)}`;
        
        onChange(newText);

        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + openTag.length + (content || '').length + closeTag.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };
    
    const handleColorClick = (color) => {
        applyFormat('color', color);
        setShowColors(false);
    };

    const handleMentionButtonClick = (type, e) => {
        setMentionState({
            visible: true,
            type: type,
            buttonRef: e.currentTarget,
        });
    };

    const handleMentionSelect = (selectedItem) => {
        const { type } = mentionState;
        if (type === 'island') {
            applyFormat('island', { x: selectedItem.x, y: selectedItem.y, name: `Island (${selectedItem.x},${selectedItem.y})` });
        } else {
            let params = { 
                id: selectedItem.id, 
                name: selectedItem.name,
                ownerId: selectedItem.ownerId,
                x: selectedItem.x,
                y: selectedItem.y
            };
            applyFormat(type, params);
        }
        setMentionState({ visible: false, type: null, buttonRef: null });
    };
    
    const colors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

    return (
        <div className="text-editor-container">
             {mentionState.visible && (
                <MentionInput
                    type={mentionState.type}
                    data={
                        mentionState.type === 'player' ? players :
                        mentionState.type === 'city' ? cities :
                        mentionState.type === 'alliance' ? alliances : []
                    }
                    onSelect={handleMentionSelect}
                    onClose={() => setMentionState({ visible: false, type: null, buttonRef: null })}
                    buttonRef={mentionState.buttonRef}
                />
            )}
            <div className="editor-toolbar">
                <button type="button" onClick={() => applyFormat('b')} className="toolbar-btn" title="Bold">B</button>
                <button type="button" onClick={() => applyFormat('i')} className="toolbar-btn italic" title="Italic">I</button>
                <button type="button" onClick={() => applyFormat('u')} className="toolbar-btn underline" title="Underline">U</button>
                <button type="button" onClick={() => applyFormat('spoiler')} className="toolbar-btn" title="Spoiler">S</button>
                <div className="relative">
                    <button type="button" onClick={() => setShowColors(!showColors)} className="toolbar-btn" title="Text Color">A</button>
                    {showColors && (
                        <div className="color-palette">
                            {colors.map(color => (
                                <button key={color} type="button" onClick={() => handleColorClick(color)} className="color-swatch" style={{ backgroundColor: color }} />
                            ))}
                        </div>
                    )}
                </div>
                <button type="button" onClick={() => applyFormat('size', '10')} className="toolbar-btn" title="Font Size">Size</button>
                <button type="button" onClick={() => applyFormat('img')} className="toolbar-btn" title="Image">Img</button>
                <button type="button" onClick={() => applyFormat('url', 'Link Text')} className="toolbar-btn" title="URL">URL</button>
                <button type="button" onClick={(e) => handleMentionButtonClick('player', e)} className="toolbar-btn" title="Player">P</button>
                <button type="button" onClick={(e) => handleMentionButtonClick('alliance', e)} className="toolbar-btn" title="Alliance">A</button>
                <button type="button" onClick={(e) => handleMentionButtonClick('city', e)} className="toolbar-btn" title="City">C</button>
                <button type="button" onClick={(e) => handleMentionButtonClick('island', e)} className="toolbar-btn" title="Island">I</button>
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="editor-textarea"
            />
        </div>
    );
};

export default TextEditor;
