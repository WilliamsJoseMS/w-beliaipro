import React, { useState, useEffect } from 'react';

interface TimePickerProps {
    value: string; // Formato de base de datos 'HH:mm' (24 hrs)
    onChange: (value: string) => void;
    className?: string;
    required?: boolean;
}

export function TimePicker({ value, onChange, className = '', required = false }: TimePickerProps) {
    // Asegurarse de que el valor tenga el formato HH:mm (algunos valores en DB pueden traer segundos)
    const normalizedValue = value ? value.substring(0, 5) : '';

    return (
        <div className={`relative flex items-center ${className}`}>
            <input
                type="time"
                value={normalizedValue}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer hover:border-slate-600"
            />
            {/* Opcional: Icono de reloj si se prefiere, pero el nativo ya suele traer uno */}
        </div>
    );
}
