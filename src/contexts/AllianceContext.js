/* # Copyright (c) 2025 Jane Doe
# All rights reserved.
#
# This file is part of "Spolkip".
#
# Unauthorized copying, modification, distribution, or use of this file,
# in whole or in part, is strictly prohibited without prior written permission.
*/
import { createContext, useContext } from 'react';

const AllianceContext = createContext();

export const useAlliance = () => useContext(AllianceContext);

export default AllianceContext;
